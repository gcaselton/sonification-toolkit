import { lazy, Suspense } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from "../ui/PageContainer";
import {
  Box,
  Heading,
  Text,
} from "@chakra-ui/react";

export default function Refine() {

    const navigate = useNavigate();
    const location = useLocation();
    const dataName = location.state.dataName
    const dataRef = location.state.dataRef
    const soniType = location.state.soniType
    const ra = location.state.ra ?? null;
    const dec = location.state.dec ?? null;
    const userUpload = location.state.userUpload ?? false;


    // Dynamically import the menu component
    const Menu = lazy(() => import(`../refine_menus/${soniType}.tsx`));


    return(
        <PageContainer>
            <Box position='relative' as='main' role='main'>
                <Heading as='h1'>Step 2: Refine</Heading>
                <br />
                <Text textStyle='lg'>Optionally, edit the {dataName} dataset</Text>
                <br />
                <br />
                <Suspense>
                    <Menu 
                        dataRef={dataRef}
                        dataName={dataName}
                        onApply={(newRef: string, newRa?: number, newDec?: number) => {
                            // Navigate with refined data
                            
                            navigate('/style', { state: { 
                                dataRef: newRef, 
                                dataName, 
                                soniType, 
                                ra: newRa ?? ra, 
                                dec: newDec ?? dec,
                                userUpload 
                            } });
                            }}/>
                </Suspense>
            </Box>
        </PageContainer>
    )
}