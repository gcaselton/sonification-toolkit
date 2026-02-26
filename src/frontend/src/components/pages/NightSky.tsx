import { useNavigate } from "react-router-dom";
import PageContainer from "../ui/PageContainer";
import { nightSkyAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";
import {
  Box,
  Heading,
  Text,
} from "@chakra-ui/react";
import ObserverSetup, { ObserverValues } from "../utils/ObserverSetup";

export default function NightSky() {
  const soniType = "night_sky";
  const navigate = useNavigate();

  const handleSubmit = async ({
    latitude,
    longitude,
    locationName,
    orientation,
    dateTime,
  }: ObserverValues) => {
    const response = await apiRequest(
      `${nightSkyAPI}/get-stars/`,
      {
        latitude,
        longitude,
        facing: orientation,
        date_time: dateTime,
      },
      "POST",
    );

    navigate("/refine", {
      state: {
        dataName: locationName,
        dataRef: response.file_ref,
        soniType,
      },
    });
  };

  return (
    <PageContainer>
      <Box as="main" role="main">
        <Heading as="h1">
          Night Sky
        </Heading>
        <br />
        <Text textStyle="lg">
          Select a location and time to get local stars
        </Text>
        <br />
        <br />
        <Box display="flex" justifyContent="center">
          <ObserverSetup onSubmit={handleSubmit} />
        </Box>
      </Box>
    </PageContainer>
  );
}
