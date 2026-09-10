import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
  console.log("email:", email);

  // step 2 : validate the fields

  //   if (fullName === "") {
  //     throw new ApiError(400, "fullName is required");
  //   }

  // instead of checking like this for everything we can fdo this

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //step 3 : check if there is already an email or username in db
  const existedUser = User.findOne({
    //-> findOne will return the first time it find the email or username , first occurance
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with username or email already exists");
  }

  //step 4: check for avatar and coverImage
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

  if (createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  //step 8: send response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "user registerd successfully"));
});

export { registerUser };
