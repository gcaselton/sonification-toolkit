import React, { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StyleCard from "../ui/StyleCard";
import PageContainer from "../ui/PageContainer";
import CustomStyleMenu from "../ui/CustomStyleMenu";
import { coreAPI } from "../../apiConfig";
import { apiRequest } from "../../utils/requests";

import { Box, Heading, Stack, Text } from "@chakra-ui/react";

export default function Style() {
  const navigate = useNavigate();

  // Location and state
  const location = useLocation();
  const dataName = location.state.dataName;
  const dataRef = location.state.dataRef;
  const soniType = location.state.soniType;
  const ra = location.state.ra ?? null;
  const dec = location.state.dec ?? null;

  // Dialog open/close
  const [open, setOpen] = useState(false);

  // Suggested styles
  const [suggestedStyles, setSuggestedStyles] = useState<any[]>([]);

  // Reference to the hidden file input
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch(`${coreAPI}/styles/${soniType}`)
      .then((res) => res.json())
      .then((data) => {
        data.push({ name: "Custom" });
        setSuggestedStyles(data);
      })
      .catch((err) => {
        console.error("Failed to fetch presets:", err);
      });
  }, []);

  const handleClick = async (style: any) => {
    if (style.name === "Custom") {
      setOpen(true);
    } else {
      const styleName = style.name;
      const styleDescription = style.description;
      const styleRef = style.file_ref;
      navigate("/sonify", {
        state: {
          dataName,
          dataRef,
          styleName,
          styleDescription,
          styleRef,
          soniType,
          ra,
          dec,
        },
      });
    }
  };

  const handleStyleCreated = (styleRef: string) => {
    navigate("/sonify", {
      state: {
        dataName,
        dataRef,
        styleRef,
        styleName: 'Custom',
        styleDescription: '',
        soniType,
        ra,
        dec,
      },
    });
  };

  const onFileSelect = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await apiRequest(`${coreAPI}/upload-yaml/`, formData);
      const styleRef = res.file_ref;
      navigate("/sonify", {
        state: { dataName, dataRef, styleRef, soniType, ra, dec },
      });
    } catch (err: any) {
      console.error("File upload failed:", err);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <PageContainer>
      <Box position="relative" as="main" role="main">
        <Heading as="h1">Step 3: Style</Heading>
        <br />
        <Text textStyle="lg">
          Choose from the styles below, or configure your own
        </Text>
        <br />

        <Stack
          gap="6"
          direction="row"
          wrap="wrap"
          animation="fade-in 300ms ease-out"
        >
          {suggestedStyles.map((style, index) => {
            const gradientClasses = [
              "gradient-aurora",
              "gradient-neon",
              "gradient-darkwave",
              "gradient-sunset",
              "gradient-ocean",
              "gradient-forest",
            ];
            const gradientClass =
              style.name === "Custom"
                ? "gradient-custom"
                : gradientClasses[index % gradientClasses.length];

            return (
              <Box
                key={style.name}
                onClick={() => handleClick(style)}
                style={{ cursor: "pointer", width: 200 }}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClick(style);
                  }
                }}
              >
                <StyleCard
                  title={style.name}
                  description={style.description}
                  gradientClass={gradientClass}
                  isCustom={style.name === "Custom"}
                />
              </Box>
            );
          })}
        </Stack>

        {/* Hidden file input for YAML upload */}
        <input
          ref={inputRef}
          type="file"
          accept=".yaml,.yml"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <CustomStyleMenu
          open={open}
          onOpenChange={setOpen}
          soniType={soniType}
          dataRef={dataRef}
          onStyleCreated={handleStyleCreated}
        />
      </Box>
    </PageContainer>
  );
}
