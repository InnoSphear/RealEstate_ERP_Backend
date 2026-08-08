import Groq from 'groq-sdk'

let groq = null

const getGroq = () => {
  if (!groq && process.env.GROQ_API_KEY) {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groq
}

const callGroq = async (messages, model = 'llama-3.3-70b-versatile') => {
  const client = getGroq()
  if (!client) return null
  try {
    const completion = await client.chat.completions.create({
      messages: [{ role: 'system', content: 'You are a real estate AI assistant. Respond with JSON only, no markdown.' }, ...messages],
      model,
      temperature: 0.3,
      max_tokens: 500,
    })
    return completion.choices[0]?.message?.content
  } catch (err) {
    console.error('Groq API error:', err.message)
    return null
  }
}

const parseJsonResponse = (text) => {
  if (!text) return null
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

export const calculateLeadScore = async (lead) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Analyze this lead and return a JSON object with: score (0-100), reasoning (string), and category (hot/warm/cold). Lead: ${JSON.stringify(lead)}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && typeof parsed.score === 'number') {
    return Math.min(100, Math.max(0, parsed.score))
  }

  let score = 0
  const highScoreSources = ['website', 'facebook', 'google']
  if (lead.source && highScoreSources.includes(lead.source)) {
    score += 80
  } else if (['instagram', '99acres', 'magicbricks', 'housing'].includes(lead.source)) {
    score += 60
  } else if (lead.source === 'referral') {
    score += 70
  } else if (lead.source === 'walk_in') {
    score += 50
  } else {
    score += 40
  }
  if (lead.budget && lead.budget > 0) score += 10
  if (lead.preferred_locations && lead.preferred_locations.length > 1) score += 5
  if (lead.property_type && lead.property_type.trim()) score += 5
  return Math.min(score, 100)
}

export const suggestFollowUpTime = async (lead) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Based on this lead, suggest the best follow-up time. Return JSON with: time (HH:MM AM/PM format), reason (string). Lead: ${JSON.stringify(lead)}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && parsed.time) return parsed.time

  const sourceTimeMap = {
    website: '10:00 AM', google: '10:00 AM', facebook: '5:00 PM',
    instagram: '5:00 PM', walk_in: '2:00 PM', referral: '10:00 AM',
    '99acres': '11:00 AM', magicbricks: '11:00 AM', housing: '11:00 AM',
  }
  return sourceTimeMap[lead.source] || '10:00 AM'
}

export const generateFollowUpMessage = async (lead) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Generate a personalized follow-up message for this real estate lead. Return JSON with: message (string, max 200 chars). Lead: ${JSON.stringify(lead)}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && parsed.message) return parsed.message

  const name = lead.full_name || 'there'
  const source = lead.source || 'other'
  const sourceMessages = {
    website: 'We noticed you were browsing our properties online. ',
    facebook: 'Thanks for connecting with us on Facebook! ',
    google: 'Thanks for finding us on Google! ',
    instagram: 'Thanks for following us on Instagram! ',
    walk_in: 'It was great meeting you at our office. ',
    referral: `${name}, we appreciate the referral! `,
    '99acres': 'We saw your interest on 99acres. ',
    magicbricks: 'We saw your interest on Magicbricks. ',
    housing: 'We saw your interest on Housing.com. ',
  }
  const statusMessages = {
    new: `Hi ${name}, thank you for reaching out. We would love to assist you with your property needs. Please let us know a convenient time to discuss.`,
    contacted: `Hi ${name}, following up on our conversation. We have some great options that match your requirements. Would you like to schedule a site visit?`,
    hot: `Hi ${name}, we have exclusive properties that match your preferences. Let's fast-track your search.`,
    warm: `Hi ${name}, checking in to see if you have any questions about the properties we discussed.`,
    cold: `Hi ${name}, we have new listings that might interest you. Would you like to take a look?`,
    follow_up: `Hi ${name}, this is a gentle reminder about your property inquiry. Let us know if you need assistance.`,
    site_visit: `Hi ${name}, we hope you enjoyed the site visit. We have more options to show you.`,
    negotiation: `Hi ${name}, we have an update on the terms. Please share your availability to discuss.`,
    won: `Hi ${name}, congratulations on your new property! We're glad we could help.`,
    lost: `Hi ${name}, we'd love to stay in touch if your needs change in the future.`,
  }
  const prefix = sourceMessages[source] || ''
  const message = statusMessages[lead.status] || statusMessages.new
  return `${prefix}${message}`
}

export const forecastSales = async (historyData) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Analyze this sales data and return JSON with: next_month_forecast (number), trend (upward/downward/stable), confidence (number 0-100), insights (string). Data: ${JSON.stringify({ salesHistory: historyData })}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && parsed.next_month_forecast !== undefined) {
    return {
      next_month_forecast: Math.max(0, parsed.next_month_forecast),
      trend: parsed.trend || 'stable',
      confidence: parsed.confidence || 50,
      insights: parsed.insights || '',
    }
  }

  if (!historyData || historyData.length < 2) {
    return { next_month_forecast: 0, trend: 'insufficient_data', confidence: 0, insights: 'Not enough historical data' }
  }

  const n = historyData.length
  const indices = historyData.map((_, i) => i)
  const sumX = indices.reduce((a, b) => a + b, 0)
  const sumY = historyData.reduce((a, b) => a + b, 0)
  const sumXY = indices.reduce((sum, x, i) => sum + x * historyData[i], 0)
  const sumX2 = indices.reduce((sum, x) => sum + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  const nextMonthForecast = Math.round(slope * n + intercept)
  const trend = slope > 0 ? 'upward' : slope < 0 ? 'downward' : 'stable'
  return { next_month_forecast: Math.max(0, nextMonthForecast), trend, confidence: 50, insights: 'Based on linear regression' }
}

export const recommendProperties = async (client, availableProperties) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Given a client profile and available properties, return JSON with: recommendations (array of property indices, max 5), reasoning (string). Client: ${JSON.stringify(client)}, Properties: ${JSON.stringify(availableProperties.map((p, i) => ({ index: i, ...p })))}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && Array.isArray(parsed.recommendations)) {
    return parsed.recommendations
      .filter(i => i >= 0 && i < availableProperties.length)
      .slice(0, 5)
      .map(i => ({ ...availableProperties[i], relevanceScore: 100 - (i * 5) }))
  }

  const scored = availableProperties.map((property) => {
    let score = 0
    const clientBudgetMin = client.budget_min || 0
    const clientBudgetMax = client.budget_max || Infinity
    const propertyPrice = property.price_sale || property.rent_amount || 0
    if (propertyPrice >= clientBudgetMin && propertyPrice <= clientBudgetMax) {
      score += 40
    } else {
      const midBudget = (clientBudgetMin + clientBudgetMax) / 2
      const diff = Math.abs(propertyPrice - midBudget)
      const maxDiff = Math.max(midBudget - clientBudgetMin, clientBudgetMax - midBudget) || 1
      score += Math.max(0, 40 - (diff / maxDiff) * 20)
    }
    if (client.preferred_locations && client.preferred_locations.length > 0) {
      const locationMatch = client.preferred_locations.some(
        (loc) => property.location && property.location.toLowerCase().includes(loc.toLowerCase())
      )
      if (locationMatch) score += 30
    }
    if (client.property_type_preference && property.property_type) {
      if (client.property_type_preference === property.property_type) score += 20
    }
    if (client.requirement_type) {
      if (client.requirement_type === 'rent' && property.listing_type === 'rent') score += 10
      else if (client.requirement_type === 'buy' && property.listing_type === 'sale') score += 10
    }
    return { ...property, relevanceScore: Math.min(score, 100) }
  })
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore)
  return scored.slice(0, 5)
}

export const analyzeSentiment = async (text) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Analyze the sentiment of this text. Return JSON with: sentiment (positive/negative/neutral), score (0-100), keyPhrases (array of strings). Text: "${text}"` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && parsed.sentiment) {
    return { sentiment: parsed.sentiment, score: parsed.score || 50, keyPhrases: parsed.keyPhrases || [] }
  }
  return { sentiment: 'neutral', score: 50, keyPhrases: [] }
}

export const generateSmartInsights = async (data) => {
  const aiResult = await callGroq([
    { role: 'user', content: `Analyze this real estate business data and return JSON with: insights (array of { title: string, description: string, type: positive/negative/neutral, priority: high/medium/low }), max 5 insights. Data: ${JSON.stringify(data)}` }
  ])

  const parsed = parseJsonResponse(aiResult)
  if (parsed && Array.isArray(parsed.insights)) {
    return parsed.insights.slice(0, 5)
  }
  return []
}
