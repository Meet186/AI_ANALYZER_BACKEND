const mongoose = require("mongoose");
const env = require("./env");

mongoose.set("strictQuery",true);

async function connectDB() {
    const conn = await mongoose.connect(env.mongoUrl, {
        serverSelectionTimeoutMS : 10_000,
    });
    console.log(`MongoDB connected : ${conn.connection.host}/${conn.connect.name}`);

    mongoose.connection.on("error", (err)=>{
        console.log(`MongoDB error : ${err.message}`);
    });

     mongoose.connection.on("disconnected", ()=>{
        console.log(`MongoDB disconnect`);
    });
}

module.exports = {connectDB};
