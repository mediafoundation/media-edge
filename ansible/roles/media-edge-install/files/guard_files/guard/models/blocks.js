module.exports = (sequelize, DataTypes) => {

  const Blocks = sequelize.define('Blocks', {
          network: {
            type: DataTypes.INTEGER, 
            primaryKey: true
          },
          block: DataTypes.INTEGER,
      }, { freezeTableName: true }
  )

  Blocks.sync({force: false})
  return Blocks

}