

export const getImage = (imageName: string, extension: string = '.jpg') => {
  return new URL(`../assets/images/${imageName}${extension}`, import.meta.url).href;
};

export const getAudio = (audioName: string) => {
  return new URL(`../assets/audio/${audioName}.mp3`, import.meta.url).href;
};