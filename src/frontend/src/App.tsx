import { ChakraProvider } from '@chakra-ui/react'
import { defaultSystem } from "@chakra-ui/react"
import Header from "./components/Header";
import Lightcurves from './components/Lightcurves';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <Header />
      <Lightcurves />  {/* new */}
    </ChakraProvider>
  )
}

export default App;

