const express = require("express");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios");
const path = require("path");

const app = express();
const port = 3021;

const allowOrigin = "https://app.udonswap.org";

// app.use(cors({ origin: allowOrigin }));

app.use(cors());
app.use(express.json());

app.get('/api/unitags/:address', async (req, res) => {
  const { address } = req.params;
  try {
      const response = await axios.get(`https://api.uniswap.org/unitags/address?address=${address}`);
      res.json(response.data);
  } catch (error) {
      res.status(500).send('Error fetching data from Uniswap API');
  }
});

app.get("/v3-tokens", (req, res) => {
  const jsonFilePath = path.join(__dirname, "uniswap-default.tokenlist.json"); // Update this with your file name
  try {
    const fileContents = fs.readFileSync(jsonFilePath);
    const jsonData = JSON.parse(fileContents);
    res.json(jsonData);
  } catch (error) {
    console.error("Error reading JSON file:", error.message);
    res.status(500).json({ error: "Failed to fetch JSON file" });
  }
});

app.get("/unsupported-tokens", (req, res) => {
  const jsonFilePath = path.join(__dirname, "unsupported.json"); // Update this with your file name
  try {
    const fileContents = fs.readFileSync(jsonFilePath);
    const jsonData = JSON.parse(fileContents);
    res.json(jsonData);
  } catch (error) {
    console.error("Error reading JSON file:", error.message);
    res.status(500).json({ error: "Failed to fetch JSON file" });
  }
});

const checkOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  if (origin !== allowOrigin) {
    return res
      .status(403)
      .json({ success: false, error: "Unauthorized access" });
  }
  next();
};

// Construct the path to Tokens.json file
const tokensFilePath = path.join(__dirname, "Tokens.json");

app.get("/", (req, res) => {
  res.send("Welcome to udonswap token APIs");
});

// Endpoint to fetch tokens from Tokens.json file ==> First Requirement
app.get("/tokens", (req, res) => {
  try {
    // Read Tokens.json file
    const tokensFile = fs.readFileSync(tokensFilePath);
    const tokensData = JSON.parse(tokensFile);

    // Send the tokens data as the response
    res.json(tokensData);
  } catch (error) {
    console.error("Error reading Tokens.json file:", error.message);
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// Endpoint to update the logoURI of a token ==> Third Requirement
app.post("/addlogoURI", (req, res) => {
  try {
    const { address, url } = req.body;

    if (!address || !url) {
      return res
        .status(400)
        .json({ error: "Missing address or URL in request body" });
    }

    fs.readFile(tokensFilePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading token list:", err);
        return res.status(500).json({ error: "Internal server error" });
      }

      let tokenList = JSON.parse(data);
      const tokenIndex = tokenList.tokens.findIndex(
        (token) => token.address === address
      );
      if (tokenIndex === -1) {
        return res.status(404).json({ error: "Token not found" });
      }

      tokenList.tokens[tokenIndex].logoURI = url;
      fs.writeFile(
        tokensFilePath,
        JSON.stringify(tokenList, null, 2),
        (err) => {
          if (err) {
            console.error("Error writing token list:", err);
            return res.status(500).json({ error: "Internal server error" });
          }
          res.json({ message: "LogoURI updated successfully" });
        }
      );
    });
  } catch (error) {
    console.error("Error updating logoURI:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to add new token to Tokens.json file ==> Fourth Requirement
app.post("/tokenAddress", async (req, res) => {
  try {
    const { address } = req.body;
    // console.log(address);

    if (!address) {
      return res
        .status(400)
        .json({ error: "Missing token address in request body" });
    }

    let updatedTokens = JSON.parse(fs.readFileSync(tokensFilePath, "utf8"));

    // Check if token with given address already exists
    if (!updatedTokens.tokens.find((t) => t.address === address)) {
      const response = await axios.get(
        `https://sepolia.explorer.mode.network/api/v2/tokens/${address}`
      );
      const tokenData = response.data;
      const token = {
        chainId: 919,
        address: tokenData.address,
        symbol: tokenData.symbol || tokenData.name,
        name: tokenData.name,
        decimals: Number(tokenData.decimals),
        tags: ["ERC-20"],
      };

      // Add logoURI if it's not null
      if (tokenData.icon_url !== null) {
        token.logoURI = tokenData.icon_url;
      }

      updatedTokens.tokens.push(token);
      fs.writeFileSync(tokensFilePath, JSON.stringify(updatedTokens, null, 2));
    }
    res.json(updatedTokens.tokens);
  } catch (error) {
    console.error("Error fetching or adding token:", error);
    return res.status(500).json({ error: "Failed to fetch or add token" });
  }
});

// Start the server;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
