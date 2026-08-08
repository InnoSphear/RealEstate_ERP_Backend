import Notification from '../models/Notification.js'

export const createNotification = async ({ tenant, recipient, type, channel, title, message, data, link }) => {
  try {
    const notification = await Notification.create({
      tenant,
      recipient,
      type,
      channel,
      title,
      message,
      data,
      link,
    })
    return notification
  } catch (error) {
    console.error('Create notification error:', error)
    throw error
  }
}

export const sendEmailNotification = async (notification) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      notification._id,
      { is_sent: true, sent_at: new Date() },
      { new: true }
    )
    return updated
  } catch (error) {
    console.error('Send email notification error:', error)
    throw error
  }
}

export const sendInAppNotification = async (notification) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      notification._id,
      { is_sent: true, sent_at: new Date() },
      { new: true }
    )
    return updated
  } catch (error) {
    console.error('Send in-app notification error:', error)
    throw error
  }
}

export const notifyFollowUp = async (followUp) => {
  try {
    const notification = await createNotification({
      tenant: followUp.tenant,
      recipient: followUp.assigned_to,
      type: 'in_app',
      channel: 'in_app',
      title: 'Follow-Up Reminder',
      message: `You have a follow-up scheduled for ${new Date(followUp.follow_up_date).toLocaleDateString()}`,
      data: { followUpId: followUp._id, leadId: followUp.lead, clientId: followUp.client },
      link: followUp.lead ? `/leads/${followUp.lead}` : `/clients/${followUp.client}`,
    })
    return notification
  } catch (error) {
    console.error('Notify follow-up error:', error)
    throw error
  }
}

export const notifyLeadAssignment = async (lead, assignedTo) => {
  try {
    const notification = await createNotification({
      tenant: lead.tenant,
      recipient: assignedTo._id,
      type: 'in_app',
      channel: 'in_app',
      title: 'Lead Assigned',
      message: `Lead ${lead.full_name} has been assigned to you`,
      data: { leadId: lead._id },
      link: `/leads/${lead._id}`,
    })
    return notification
  } catch (error) {
    console.error('Notify lead assignment error:', error)
    throw error
  }
}

export const notifyKeyIssued = async (key, issuedTo) => {
  try {
    const notification = await createNotification({
      tenant: key.tenant,
      recipient: issuedTo._id,
      type: 'in_app',
      channel: 'in_app',
      title: 'Key Issued',
      message: `Property key ${key.key_number} has been issued to you`,
      data: { keyId: key._id, propertyId: key.property },
      link: `/properties/${key.property}/keys`,
    })
    return notification
  } catch (error) {
    console.error('Notify key issued error:', error)
    throw error
  }
}
