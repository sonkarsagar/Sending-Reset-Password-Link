const Razorpay = require("razorpay");
const expense = require("../models/expense");
const Orders = require("../models/orders");
const user = require("../models/user");
const Leaderboard = require("../models/leaderboard");
const sequelize = require("../util/database");

// req.user from auth.authorize via routes
exports.postExpense = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const result = await expense.create(
      {
        amount: req.body.amount,
        description: req.body.description,
        category: req.body.category,
        userId: req.user.id,
      },
      { transaction: t }
    );
    res.status(200).send(result);
    const user1 = await user.findOne({ where: { id: result.userId } });
    const response = await Leaderboard.findOne({ where: { userId: user1.id } });
    if (response) {
      await response.update(
        {
          totalExpense:
            parseInt(response.totalExpense) + parseInt(result.amount),
        },
        { transaction: t }
      );
    } else {
      await Leaderboard.create(
        {
          name: user1.name + " " + user1.sur,
          totalExpense: result.amount,
          userId: user1.id,
        },
        { transaction: t }
      );
    }
    await t.commit();
  } catch (error) {
    await t.rollback();
    console.log(error);
  }
};

exports.deleteExpense = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const result = await expense.findByPk(req.params.id);
    console.log(result)
    const response = await Leaderboard.findOne({
      where: { userId: result.userId },
    });
    await response.update(
      {
        totalExpense: parseInt(response.totalExpense) - parseInt(result.amount),
      },
      { transaction: t }
    );
    res.status(200).send(result);
    await result.destroy({ transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    console.log(error);
  }
};

exports.getExpense = async (req, res, next) => {
  try {
    const result = await expense.findAll({ where: { userId: req.user.id } });
    res.json(result);
  } catch (error) {
    console.log(error);
  }
};

exports.getexpensePremium = async (req, res, next) => {
  try {
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const amount = 2500;
    await rzp.orders.create({ amount, currency: "INR" }, async (err, order) => {
      if (err) {
        res.status(400).json({ error: err.message });
      } else {
        try {
          const t = await sequelize.transaction();
          const result = await req.user.createOrder(
            {
              orderId: order.id,
              status: "PENDING",
            },
            { transaction: t }
          );
          res.status(201).json({ order, key_id: rzp.key_id });
          await t.commit();
        } catch (error) {
          await t.rollback();
          console.log(error);
        }
      }
    });
  } catch (error) {
    console.log(error);
  }
};

exports.postexpenseSuccess = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const result = await Orders.findOne({
      where: { orderId: req.body.order_id },
    });
    await result.update(
      { paymentId: req.body.payment_id, status: "SUCCESS" },
      { transaction: t }
    );
    const response = await user.findOne({ where: { id: result.userId } });
    await response.update({ premiumUser: true }, { transaction: t });
    await t.commit();
  } catch (error) {
    await t.rollback();
    console.log(error);
  }
};

exports.postexpenseFail = async (req, res, next) => {
  // const t = await sequelize.transaction();
  try {
    const result = await Orders.findOne({
      where: { orderId: req.body.order_id },
    });
    result.update(
      { paymentId: "failed", status: "FAILED" }
      // { transaction: t }
    );
    // await t.commit();
  } catch (error) {
    // await t.rollback();
    console.log(error);
  }
};

exports.getpremiumLeaderboard = async (req, res, next) => {
  try {
    const result = await Leaderboard.findAll({
      order: [["totalExpense", "DESC"]],
      limit: 10,
    });
    res.status(201).send(result);
  } catch (error) {
    console.log(error);
  }
};
