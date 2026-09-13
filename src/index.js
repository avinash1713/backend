import dotenv from "dotenv";
import connectDB from "./db/index.js";
dotenv.config({ path: "./.env" });
import { app } from "./app.js";

connectDB() //this will return a promise as we are using a sync await syntax
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running at port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.log("mongodb connection failed");
  });

/*
import mongoose from "mongoose";
import { DB_NAME } from "./constants";
import express from "express";
const app = express()(

   // using normal function
  // function connectDB() {}
  // connectDB()

  //using iife
  async () => {
    try {
      await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
      app.on("error", (error) => {
        console.log("ERROR:", error);
        throw error;
      });

      app.listen(process.env.PORT, () => {
        console.log(`App is listening on port ${process.env.PORT}`);
      });
    } catch (error) {
      console.error("ERROR", error);
      throw error;
    }
  }
)();
*/
