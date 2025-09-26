import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "./models/User.js";
import Loan from "./models/Loan.js";
import Document from "./models/Document.js";

// Load environment variables
dotenv.config();

const reset = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await User.deleteMany({});
    await Loan.deleteMany({});
    await Document.deleteMany({});

    console.log("✅ All collections cleared but structure preserved");
    process.exit();
  } catch (err) {
    console.error("❌ Error clearing DB", err);
    process.exit(1);
  }
};

reset();
