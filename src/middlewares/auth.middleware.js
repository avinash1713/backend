import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

// Middleware to verify whether the user is authenticated
export const verifyJWT = asyncHandler(async (req, res, next) => {
  try {
    // Get access token from cookie or Authorization header
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    // If no access token is provided, reject the request
    if (!token) {
      throw new ApiError(401, "Unauthorized request");
    }

    // Verify the token using the secret key
    // If the token is invalid or expired, jwt.verify() will throw an error
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Find the user in MongoDB using the user ID stored inside the JWT
    // Password and refreshToken are excluded for security
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );

    // If the user does not exist, the token is not valid for an existing user
    if (!user) {
      throw new ApiError(401, "Invalid access token");
    }

    // Attach the authenticated user to the request object
    // Controllers that run after this middleware can access the user using req.user
    req.user = user;

    // Continue to the next middleware or controller
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }
});

// import { User } from "../models/user.models";
// import { ApiError } from "../utils/ApiError";
// import { asyncHandler } from "../utils/asyncHandler";
// import jwt from "jsonwebtoken";

// export const verifyJWT = asyncHandler(async (req, res, next) => {
//   const token =
//     req.cookies?.accessToken ||
//     req.header("Authorization")?.replace("Bearer ", "");

//   if (!token) {
//     throw new ApiError(401, "Unauthorized request");
//   }

//   const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

//   const user = await User.findById(decodedToken?._id).select(
//     "-password -refreshToken"
//   );
//   if (!user) {
//     throw new ApiError(401, "Invalid access token");
//   }

//   req.user = user;
//   next();
// });
