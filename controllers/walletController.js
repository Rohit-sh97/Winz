import Wallet from "../models/walletModel.js";
import Transaction from "../models/transactionModel.js";
import Referral from "../models/referralModel.js";
import UserInvestment from "../models/userInvestmentModel.js";


export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.userId; 
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }
    res.status(200).json({ success: true, wallet });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getTransactions = async (req, res) => {
  try {
    const userId = req.userId;
    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });
    if (!transactions) {
      return res.status(404).json({ success: false, message: "No transactions found" });
    }
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const depositFunds = async (req, res) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    wallet.balance += amount;
    await wallet.save();

    await Transaction.create({
      userId,
      type: "deposit",
      amount,
      status: "pending",
    });

    // Check for a referral and apply 10% commission only once
    const referral = await Referral.findOne({
      referredUser: userId,
      isCommissionGiven: false
    });

    if (referral) {
      const referrerWallet = await Wallet.findOne({ userId: referral.referredBy });
      if (referrerWallet) {
        const commission = amount * 0.1;
        referrerWallet.commission += commission;
        await referrerWallet.save();

        referral.isCommissionGiven = true; // Mark commission as given
        await referral.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Deposit successful",
      wallet,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const withdrawFunds = async (req, res) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: "Wallet not found" });
    }

    const plan = await UserInvestment.findOne({ userId });

    let availableBalance = wallet.balance;

    if (plan && plan.status === "active") {
      availableBalance = wallet.balance - plan.lockedAmount;
    }

    if (amount <= 100) {
      return res.status(400).json({ success: false, message: "Minimum withdrawal is ₹100" });
    }

    if (availableBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient withdrawable balance. You can withdraw up to ₹${availableBalance}` 
      });
    }

    wallet.balance -= amount;
    await wallet.save();

    await Transaction.create({
      userId,
      type: "withdrawal",
      amount,
      status: "pending"
    });

    res.status(200).json({ 
      success: true, 
      message: "Withdrawal successful", 
      wallet 
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


// GET /api/reward/referral-income
export const getReferralIncomeDetails = async (req, res) => {
  try {
    const userId = req.userId;

    const referrals = await Referral.find({ referredBy: userId, isCommissionGiven: true })
      .populate("referredUser", "name email username")
      .exec();

    const result = [];

    for (const ref of referrals) {
      const investment = await UserInvestment.findOne({ userId: ref.referredUser._id });
      const rewardAmount = investment ? investment.amount * (ref.commissionPercent / 100) : 0;

      result.push({
        fromUser: ref.referredUser,
        rewardAmount,
        investmentAmount: investment ? investment.amount : 0,
        commissionPercent: ref.commissionPercent,
        date: ref.createdAt,
      });
    }

    res.status(200).json({
      success: true,
      message: "Referral income details fetched",
      data: result,
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
