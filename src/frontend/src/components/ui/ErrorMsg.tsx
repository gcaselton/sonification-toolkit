import { Alert } from "@chakra-ui/react";

const ErrorMsg = ({ message }: {message: string}) => (
  <Alert.Root 
    status='error'
    animation="fade-in 300ms ease-out"
    role="alert"
    aria-live="assertive">
    <Alert.Indicator />
       <Alert.Content>
          <Alert.Title>{message}</Alert.Title>
      </Alert.Content>
  </Alert.Root>   
);

export default ErrorMsg;
