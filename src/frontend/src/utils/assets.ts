

export const getImage = (imageName: string, extension: string = '.jpg') => {
  return new URL(`../assets/images/${imageName}${extension}`, import.meta.url).href;
};

export const getAudio = (audioName: string) => {
  return new URL(`../assets/audio/${audioName}.mp3`, import.meta.url).href;
};

// Generate a random time for each twinkle animation to make each unique
export const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;