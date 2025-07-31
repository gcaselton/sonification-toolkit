import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { Flex } from '@chakra-ui/react'
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Lightcurves from './components/Lightcurves';
import Sound from './components/Sound';
import Sidebar from './components/Sidebar';
import Sonify from './components/Sonify';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <Flex direction="column" align="center" justify="flex-start" minH="100vh" p={6}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Lightcurves />} />
            <Route path="/sound" element={<Sound />} />
            <Route path="/sonify" element={<Sonify />} />
          </Routes>
        </BrowserRouter>
      </Flex>
    </ChakraProvider>
  )
}

export default App;

