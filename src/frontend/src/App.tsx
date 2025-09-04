import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { Flex } from '@chakra-ui/react'
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Lightcurves from './components/pages/Lightcurves';
import Style from './components/pages/Style';
import Sonify from './components/pages/Sonify';
import Help from './components/pages/Help';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <Flex direction="column" align="center" justify="flex-start" minH="100vh" p={8}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Lightcurves />} />
            <Route path="/style" element={<Style />} />
            <Route path="/sonify" element={<Sonify />} />
            <Route path='/help' element={<Help />} />
          </Routes>
        </HashRouter>
      </Flex>
    </ChakraProvider>
  )
}

export default App;

