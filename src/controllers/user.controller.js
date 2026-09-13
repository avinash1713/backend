import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    { $set: { refreshToken: undefined } },
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

export { registerUser, loginUser, logoutUser };
