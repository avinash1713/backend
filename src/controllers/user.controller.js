import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // we save the refresh token in our db so that we dont have to ask for password from user again and again
    user.refreshToken = refreshToken; // user have all the field that are in the User model so i want to change that refreshtoken field from that obj
    await user.save({ validateBeforeSave: false }); // validateBeforesave this helps to nullify the required:true that we use in User model for password etc. "Don't run Mongoose's validation checks before saving this document."

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //get user detail from frontend
  //validation- not empty
  //check if user already exist: username email
  //check for images, check for avatar
  // upload that to cloudinary,here also check avatar
  //create user object- create entry in db
  //remove password and refreshtoken field from response
  //check for user creation - reponse should not be null
  // if user is created - return response
  //else send error

  //step 1 : details from user
  const { fullName, username, email, password } = req.body;

  // step 2 : validate the fields

  //   if (fullName === "") {
  //     throw new ApiError(400, "fullName is required");
  //   }

  // instead of checking like this for everything we can fdo this

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
    //[10, 20, 30, 5].some((number) => number < 10)  Result:true
    //"   Rahul   ".trim()  becomes:"Rahul"
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //step 3 : check if there is already an email or username in db
  const existedUser = await User.findOne({
    //-> findOne will return the first time it find the email or username , first occurance
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists");
  }

  //step 4: check for avatar and coverImage

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  // let coverImageLocalPath;
  // if (
  //   req.files &&
  //   Array.isArray(req.files.coverImage) &&
  //   req.files.coverImage.length > 0
  // ) {
  //   coverImageLocalPath = req.files.coverImage[0].path;
  // }

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar file is required");
  }

  //step 5 : upload them on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  //step 6: check again if avatar is available
  if (!avatar) {
    throw new ApiError(400, "avatar file is required");
  }

  // step 7: create an object and enter it in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    avatarPublicId: avatar.public_id,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  //step 8 : check if this user obj is created in db or not and remove fields password and refreshtoken
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //step 8: send response
  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "user registerd successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  //  get data from the req body
  //check username and email based access which ever you want to give
  //find the user
  //validate from mongo db
  //check for password
  //Verify password
  //  ↓
  // Generate Access Token
  // Generate Refresh Token
  //  ↓
  // Save Refresh Token in DB
  //  ↓
  // Send both as httpOnly cookies
  // access and refresh token genrate token
  //send these token in cookies (secure cokkies)
  // send response

  //Step 1 : Take data from request body
  const { email, username, password } = req.body;

  //setp 2: check there should be email or username atleast
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }

  //step 3: if you are resgitered so there should be a username or email in db with same check for that
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  //step 4: if user dont exist give an err
  if (!user) {
    throw new ApiError(404, "user does not exist");
  }

  //step 5 : check for password
  //CAUTION : methods that i gererate is accessed using the monogoDB user(user) not mongoose model user(User)
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  //setp 6 : getenrate refresh and access token
  // we use a method here for that
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  //step 7:we have user from 4th step BUT as we call this from db it gives use all the info like unwanted one as well {password and refreshToken}
  // so we want to modify that and remove that info from our user
  const loggedinUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  // now loggedinUser have all the field that we want to send

  //Step 8: we have to send cookies
  const options = {
    httpOnly: true, // By default anyone can modify our cokkie form frontend but when we pass
    secure: true, // these 2 options so now they can be modfied from server only
  };

  //step 9 : send response
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedinUser, accessToken, refreshToken },
        "user loggedin successfully "
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  // Find the currently logged-in user using the ID
  // that verifyJWT middleware stored in req.user
  // Then remove the refreshToken from the user's document
  await User.findByIdAndUpdate(
    req.user._id,
    { $unset: { refreshToken: 1 } }, // this remove field from the document
    { new: true }
  );

  // Cookie options should match the options used
  // when the cookies were originally created
  const options = {
    httpOnly: true,
    secure: true,
  };

  // Clear both accessToken and refreshToken cookies
  // and send a successful response to the client
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from request
  // Check if refresh token is available
  // Verify the refresh token using REFRESH_TOKEN_SECRET
  // Get the user ID from the decoded refresh token
  // Find the user in MongoDB
  // Check if user exists
  // Compare incoming refresh token with refresh token saved in DB
  // Generate new Access Token // Generate new Refresh Token
  // Save the new Refresh Token in DB
  // Send new Access Token and Refresh Token as httpOnly cookies
  // Send response

  // Step 1 : you need to send me the refreshToken to me so i can access that from cookies
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request"); // beacuse your token is not correct thats why unauthorized req
  }

  try {
    // Step 2 : now we need to verify the token
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Step 3 : we need to get the user with same refresh token from db
    const user = await User.findById(decodedToken?._id);

    // Step 4 : now we check if user is avaialable or not someone might give fake token
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Step 5 :
    // incomingrefresh token - token given by user
    // then we have a refresh token that we save in db in method generateAccessAndRefreshToken
    // threfore the user that we find from that incomingRefreshToken also have same a refreshtoken that we store for that user in db

    if (incomingRefreshToken != user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    // Step 6 : genrate new refreshtoken if same
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    // Step 7 : send response
    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "invalid refresh token");
  }
});

const changeCurrentUserPassword = asyncHandler(async (req, res) => {
  // Step 1: Get the old password and new password from the request body
  const { oldPassword, newPassword } = req.body;

  // Step 2: Find the currently logged-in user using the user ID
  // req.user.id is added by the authentication middleware
  const user = await User.findById(req.user?._id);

  // Step 3: Check whether the old password entered by the user
  // matches the password stored in the database
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  // Step 4: If the old password is incorrect, throw an error
  if (!isPasswordCorrect) {
    throw new ApiError(401, "invalid old password");
  }

  // Step 5: Set the new password
  user.password = newPassword;

  // Step 6: Save the updated user document in the database
  // validateBeforeSave: false skips schema validation
  // The pre-save middleware will still hash the new password
  await user.save({ validateBeforeSave: false });

  // Step 7: Send a successful response to the client
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  // Step 1: Send the currently logged-in user's details as a response
  // req.user is added by the authentication middleware
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  // Step 1: Get the full name and email from the request body
  const { fullName, email } = req.body;

  // Step 2: Check whether both required fields are provided
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  // Step 3: Find the currently logged-in user using their _id
  // and update the fullName and email fields
  // new: true returns the updated user document
  // select("-password") prevents the password from being included
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    { $set: { fullName: fullName, email: email } },
    { new: true }
  ).select("-password");

  // Step 4: Send the updated account details as the response
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

// const updateUserAvatar = asyncHandler(async (req, res) => {
//   // Step 1: Get the local path of the uploaded avatar file from Multer
//   const avatarLocalPath = req.file?.path; // we get this from multer middleware

//   // Step 2: Check whether an avatar file was uploaded
//   if (!avatarLocalPath) {
//     throw new ApiError(400, "Avatar file is missing");
//   }

//   // Step 3: Upload the avatar file from the local path to Cloudinary
//   const avatar = await uploadOnCloudinary(avatarLocalPath);

//   // Step 4: Check whether the avatar was successfully uploaded to Cloudinary
//   if (!avatar.url) {
//     throw new ApiError(400, "Error while uploading avatar on cloudinary");
//   }

//   // Step 5: Find the current user and update their avatar URL
//   // new: true returns the updated user document
//   // select("-password") prevents the password from being included
//   const user = await User.findByIdAndUpdate(
//     req.user._id,
//     {
//       $set: { avatar: avatar.url },
//     },
//     { new: true }
//   ).select("-password");

//   // Step 6: Return the updated user details as the response
//   return res
//     .status(200)
//     .json(new ApiResponse(200, user, "Avatar updated successfully"));
// });

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Step 1: Get the local path of the uploaded avatar file from Multer
  const avatarLocalPath = req.file?.path; // we get this from multer middleware

  // Step 2: Check whether an avatar file was uploaded
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  // Step 3: Upload the avatar file from the local path to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // Step 4: Check whether the avatar was successfully uploaded to Cloudinary
  if (!avatar?.url) {
    throw new ApiError(400, "Error while uploading avatar on cloudinary");
  }

  // Step 5: Find the current user to get the old avatar public_id
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Step 6: Delete the old avatar from Cloudinary
  if (user.avatarPublicId) {
    await deleteFromCloudinary(user.avatarPublicId);
  }

  // Step 7: Update the user's avatar URL and public_id with the new image
  user.avatar = avatar.url;
  user.avatarPublicId = avatar.public_id;

  await user.save({ validateBeforeSave: false });

  // Step 8: Get the updated user without password and refreshToken
  const updatedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // Step 9: Return the updated user details as the response
  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path; // we get this from multer middleware

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading coverImage on cloudinary");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { coverImage: coverImage.url },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Coverimage updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    // we will get values in array after aggregation [{values}]
    {
      //"From the User collection, give me the user whose username matches the username from the URL."
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      //This is basically a join between your User collection and your Subscription collection.
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      //It adds new fields to our existing document.
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exist");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "user channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [{ $project: { fullName: 1, username: 1, avatar: 1 } }],
            },
          },
          {
            $addFields: { owner: { $first: "$owner" } },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "watch history fetched successfully"
      )
    );
});
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentUserPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
