import mongoose from "mongoose";

const loanSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    term: { type: Number, required: true }, // months
    interestRate: { type: Number, default: 12 },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Disbursed", "Closed"],
      default: "Pending",
    },
    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      branchCode: { type: String },
      accountHolder: { type: String },
    },
  },
  { timestamps: true } // adds createdAt & updatedAt
);

export default mongoose.model("Loan", loanSchema);
