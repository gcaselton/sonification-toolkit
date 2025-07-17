import { ChakraProvider } from '@chakra-ui/react'
import { defaultSystem } from "@chakra-ui/react"
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Lightcurves from './components/Lightcurves';
import Sonification from './components/Sonification';
import Sidebar from './components/Sidebar';

function App() {

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lightcurves />} />
          <Route path="/sonification" element={<Sonification />} />
        </Routes>
      </BrowserRouter>
    </ChakraProvider>
  )
}

export default App;

