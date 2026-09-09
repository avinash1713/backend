import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    videoFile: {
      type: String, //cloudnary Url
      requied: true,
    },
    thumbnail: {
      type: String, //cloudnary Url
      requied: true,
    },
    title: {
      type: String,
      requied: true,
    },
    description: {
      type: String,
      requied: true,
    },
    duration: {
      type: Number,
      requied: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Üser",
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);
