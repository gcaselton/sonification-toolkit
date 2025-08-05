import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'blue', // Change this to your desired default
      },
    },
  },
});

export default theme;
