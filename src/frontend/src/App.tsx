import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { Flex } from '@chakra-ui/react'
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Lightcurves from './components/Lightcurves';
import Style from './components/Style';
import Sidebar from './components/Sidebar';
import Sonify from './components/Sonify';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <Flex direction="column" align="center" justify="flex-start" minH="100vh" p={8}>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Lightcurves />} />
            <Route path="/style" element={<Style />} />
            <Route path="/sonify" element={<Sonify />} />
          </Routes>
        </HashRouter>
      </Flex>
    </ChakraProvider>
  )
}

export default App;

