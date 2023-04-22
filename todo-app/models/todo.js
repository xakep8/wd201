"use strict";
const { Model,Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Todo.belongsTo(models.User,{
        foreignKey:'userId'
      })
      // define association here
    }

    static addTodo({ title, dueDate,userId }) {
      return this.create({ title: title, dueDate: dueDate, completed: false, userId });
    }

    static getTodos() {
      return this.findAll();
    }

    static async remove(id,userId) {
      this.destroy({ where: {
          id,
          userId,
        },
      });
    }

    static async dueToday(userId){
      return this.findAll({
        where:{
          [Op.and]:[{
            dueDate:{
              [Op.eq]:new Date(),
            },
            userId,
            completed:false,
        }]
      },
      });
    }

    static async dueLater(userId){
      return this.findAll({
        where:{
          [Op.and]:[{
            dueDate:{
              [Op.gt]:new Date(),
            },
            userId,
            completed:false,
        }]
      },
      });
    }

    static async overdue(userId){
      return this.findAll({
        where:{
          [Op.and]:[{
            dueDate:{
              [Op.lt]:new Date(),
            },
            userId,
            completed:false,
        }]
      },
      });
    }

    static async completedItems(userId){
      return this.findAll({
        where:{
          [Op.and]:[{
            userId,
            completed:true,
          }]
        },
      });
    }

    static async deleteAll(){
      this.destroy({where:{}});
    }

    setCompletionStatus(state) {
      return this.update({completed:state});
    }
  }
  Todo.init(
    {
      title: DataTypes.STRING,
      dueDate: DataTypes.DATEONLY,
      completed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
