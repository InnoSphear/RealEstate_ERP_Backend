import mongoose from "mongoose";
import dns from "dns";

// Use Google DNS for SRV record resolution (corporate DNS often blocks SRV lookups)
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to db");
  } catch (error) {
    console.log(error);
  }
};

export default connectDb;
