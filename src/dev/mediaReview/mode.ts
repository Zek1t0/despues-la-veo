export function isMediaReviewEnabled(development: boolean, flag: string | undefined): boolean {
  return development && flag === "1";
}

export function mediaReviewEnabled(): boolean {
  return isMediaReviewEnabled(__DEV__, process.env.EXPO_PUBLIC_MEDIA_REVIEW);
}
