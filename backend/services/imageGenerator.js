/**
 * imageGenerator.js
 * Modular Image Generation Service for DomIQ AI.
 * Provider selection is controlled EXCLUSIVELY via IMAGE_PROVIDER env variable.
 * Supported providers: 'pollinations' | 'openrouter' | 'openai'
 * The backend exposes a single stable interface to the frontend regardless of provider.
 */

const OpenAI = require("openai");

/**
 * Pollinations AI Provider Implementation
 * Constructs an instant photorealistic image URL and verifies image availability.
 */
async function generateWithPollinations(finalPrompt, width, height, seed, style, camera) {
  console.log("[PROVIDER: POLLINATIONS] Generating image prompt:", finalPrompt);
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
  
  // We no longer ping the URL from the backend to avoid 429 Rate Limits from Pollinations.
  // We simply return the URL instantly to the frontend.
  console.log("✓ Pollinations URL generated instantly. Sending to frontend.");
  return {
    url: imageUrl,
    prompt: finalPrompt,
    style: style,
    camera: camera,
    metadata: {
      provider: "Pollinations AI",
      engine: "Pollinations Flux",
      seed: seed,
      width: width,
      height: height,
      timestamp: Date.now()
    }
  };
}

/**
 * OpenRouter Provider Implementation
 */
async function generateWithOpenRouter(finalPrompt, width, height, style, camera) {
  console.log("[PROVIDER: OPENROUTER] Generating image with OpenRouter...");
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("❌ OPENROUTER_API_KEY missing from environment variables.");
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_IMAGE_MODEL || "black-forest-labs/flux-schnell",
        messages: [{ role: "user", content: finalPrompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errText.substring(0, 200)}`);
    }

    const data = await response.json();
    const messageContent = data.choices?.[0]?.message?.content;
    
    // Extract image URL from response
    let imageUrl = null;
    if (typeof messageContent === "string") {
      const match = messageContent.match(/https?:\/\/[^\s"'\)]+\.(png|jpg|jpeg|webp)/i);
      if (match) imageUrl = match[0];
    }

    if (!imageUrl) {
      throw new Error("OpenRouter response did not return a valid image URL.");
    }

    return {
      url: imageUrl,
      prompt: finalPrompt,
      style: style,
      camera: camera,
      metadata: {
        provider: "OpenRouter",
        engine: process.env.OPENROUTER_IMAGE_MODEL || "flux-schnell",
        width: width,
        height: height,
        timestamp: Date.now()
      }
    };
  } catch (err) {
    console.error("[PROVIDER: OPENROUTER ERROR]", err.message);
    throw new Error(`❌ OpenRouter generation failed: ${err.message}`);
  }
}

/**
 * OpenAI Provider Implementation
 */
async function generateWithOpenAI(finalPrompt, width, height, style, camera) {
  console.log("[PROVIDER: OPENAI] Generating image with OpenAI...");
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("❌ OPENAI_API_KEY missing from environment variables.");
  }

  try {
    const client = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
    });

    const response = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024"
    });

    if (!response.data || response.data.length === 0 || !response.data[0].url) {
      throw new Error("OpenAI returned an empty image generation response.");
    }

    return {
      url: response.data[0].url,
      prompt: finalPrompt,
      style: style,
      camera: camera,
      metadata: {
        provider: "OpenAI",
        engine: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
        width: width,
        height: height,
        timestamp: Date.now()
      }
    };
  } catch (err) {
    console.error("[PROVIDER: OPENAI ERROR]", err.message);
    throw new Error(`❌ OpenAI generation failed: ${err.message}`);
  }
}

const imageGenerator = {
  buildPromptFromLayout: function(layout) {
    if (!layout) return "cozy modern interior design room";
    const roomType = (layout.roomType || "living room").replace(/_/g, " ");
    const w = layout.dimensions?.width || 5.0;
    const l = layout.dimensions?.length || 4.0;
    
    let desc = `A high-end interior photo of a ${roomType} measuring ${w}m by ${l}m. `;
    
    if (layout.walls && layout.walls.length > 0) {
      desc += `The room features a geometric shape layout with clear wall boundaries. `;
    }
    
    if (layout.doors && layout.doors.length > 0) {
      desc += `There is an open doorway visible at the entrance. `;
    }
    
    if (layout.windows && layout.windows.length > 0) {
      desc += `Large glass windows are positioned on the perimeter walls letting in volumetric daylight. `;
    }
    
    if (layout.furniture && layout.furniture.length > 0) {
      desc += `Furniture is arranged as follows: `;
      layout.furniture.forEach(f => {
        const nameVal = (f.name || f.type || 'furniture').toLowerCase();
        const xVal = typeof f.x === 'number' ? f.x : 0;
        const yVal = typeof f.y === 'number' ? f.y : 0;
        const rotVal = typeof f.rotation === 'number' ? f.rotation : 0;
        desc += `a ${nameVal} is positioned at coordinates (${xVal.toFixed(1)}, ${yVal.toFixed(1)}) with rotation ${rotVal} degrees, `;
      });
      desc = desc.slice(0, -2) + `. `;
    }
    
    if (layout.materials) {
      desc += `The room is finished with premium ${layout.materials.floors || 'wood'} flooring and clean ${layout.materials.walls || 'plaster'} walls. `;
    }
    
    return desc.trim();
  },

  generateImage: async function(params, signal = null) {
    const { prompt, style, camera, roomType, customPrompt } = params;
    
    const seed = Math.floor(Math.random() * 999999) + 1;
    const width = 1024;
    const height = 768;
    
    // Resolve Style Name to match the required human-friendly styles
    const styleNames = {
      modern: "Modern Luxe",
      scandinavian: "Nordic Cozy",
      minimalist: "Minimal",
      japanese: "Japandi",
      industrial: "Industrial",
      luxury: "Ultra Luxury"
    };
    const styleName = styleNames[(style || "").toLowerCase().trim()] || style || "Modern Luxe";

    // Clean up roomType (e.g., replace underscores with spaces, ensure proper casing)
    let cleanRoomType = (roomType || "Living Room").replace(/_/g, " ").trim();
    // Capitalize first letter of each word
    cleanRoomType = cleanRoomType.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const cameraView = camera || "Corner view";

    // Resolve room-specific structural details and items to treat Room Area as primary subject
    let roomSpecificDetails = "Use high-end furniture, realistic materials, elegant lighting, decorative assets and architectural visualization quality.";
    const lowerRoom = cleanRoomType.toLowerCase();
    if (lowerRoom.includes("kitchen")) {
      roomSpecificDetails = "Use premium cabinetry, marble countertops, elegant lighting, realistic materials, luxury appliances and architectural visualization quality.";
    } else if (lowerRoom.includes("bedroom")) {
      roomSpecificDetails = "Use cozy bedding, elegant headboard, nightstands, wardrobe, warm lighting, soft textiles and architectural visualization quality.";
    } else if (lowerRoom.includes("bathroom")) {
      roomSpecificDetails = "Use modern vanity, clean tiles, premium fixtures, walk-in shower, glass panel, elegant lighting and architectural visualization quality.";
    } else if (lowerRoom.includes("living room")) {
      roomSpecificDetails = "Use luxury sofa, elegant coffee table, feature wall, ambient lighting, realistic textures, decorative assets and architectural visualization quality.";
    } else if (lowerRoom.includes("dining room")) {
      roomSpecificDetails = "Use dining table, luxury chairs, ambient chandelier, tableware, refined wall panels and architectural visualization quality.";
    } else if (lowerRoom.includes("office") || lowerRoom.includes("workplace") || lowerRoom.includes("study")) {
      roomSpecificDetails = "Use executive desk, ergonomic chair, shelves, desk lamp, modern tech, professional decor and architectural visualization quality.";
    } else if (lowerRoom.includes("garden") || lowerRoom.includes("terrace") || lowerRoom.includes("outdoor") || lowerRoom.includes("patio") || lowerRoom.includes("yard")) {
      roomSpecificDetails = "Use high-end outdoor furniture, patio tiles, greenery, atmospheric lighting, landscaping and architectural visualization quality.";
    } else if (lowerRoom.includes("cafe") || lowerRoom.includes("restaurant") || lowerRoom.includes("bar")) {
      roomSpecificDetails = "Use trendy cafe seating, elegant counter, atmospheric cafe lighting, design decor, coffee equipment and architectural visualization quality.";
    } else if (lowerRoom.includes("house") || lowerRoom.includes("villa") || lowerRoom.includes("apartment") || lowerRoom.includes("home")) {
      roomSpecificDetails = "Use high-end architectural layout, multi-room overview, luxury furniture, premium materials, professional staging and architectural visualization quality.";
    }

    // Dynamic prompt construction following the strict priority: Room Area -> Design Style -> Camera View -> Custom Instructions
    let basePrompt = `Create a photorealistic ${styleName} ${cleanRoomType} interior. Show only the ${cleanRoomType}. Camera view: ${cameraView}. ${roomSpecificDetails}`;

    // Extract actual custom instructions from customPrompt parameter or parent prompt
    let actualCustomPrompt = customPrompt || "";
    if (!actualCustomPrompt && prompt) {
      if (prompt.includes("User Instructions:")) {
        actualCustomPrompt = prompt.split("User Instructions:")[1];
      }
    }
    if (actualCustomPrompt && actualCustomPrompt.trim()) {
      basePrompt += ` Additional instructions: ${actualCustomPrompt.trim()}`;
    }

    const styleEnhancers = {
      modern: "modern luxury interior design, polished concrete and marble finishes, integrated warm LED lighting, cozy luxury architectural digest style",
      scandinavian: "nordic cozy loft style, light oak wood floors, minimalist white walls, natural daylight, linen textures, indoor green plants",
      minimalist: "absolute minimalist architectural style, white plaster walls, raw limestone floors, volumetric shadow play, clean sleek design",
      japanese: "japandi style, cedar screens, tatami mats, low bamboo platform furniture, organic beige linens, zen neutral ambiance",
      industrial: "raw industrial loft, exposed red bricks, charcoal steel beam frames, grey raw concrete ceilings, rustic reclaimed wooden desks",
      luxury: "ultra-high-end luxury palace styling, dark polished marble slabs, velvet textiles, gold brass trims, crystal chandeliers"
    };

    const styleKey = (style || "modern").toLowerCase().trim();
    const styleGuide = styleEnhancers[styleKey] || styleEnhancers.modern;
    const finalPrompt = `${basePrompt}, ${styleGuide}, photorealistic interior photography, volumetric lighting, architectural digest publication, highly detailed, 8k, sharp focus, seed ${seed}`;
    
    // Validate IMAGE_PROVIDER env var
    const rawProvider = process.env.IMAGE_PROVIDER;
    if (!rawProvider || !rawProvider.trim()) {
      throw new Error("❌ IMAGE_PROVIDER not configured");
    }
    
    const provider = rawProvider.toLowerCase().trim();
    console.log(`[IMAGE GENERATOR] Selected Provider from IMAGE_PROVIDER env: '${provider}'`);

    switch (provider) {
      case "pollinations":
        return await generateWithPollinations(finalPrompt, width, height, seed, style, camera);
      case "openrouter":
        return await generateWithOpenRouter(finalPrompt, width, height, style, camera);
      case "openai":
        return await generateWithOpenAI(finalPrompt, width, height, style, camera);
      default:
        throw new Error(`❌ IMAGE_PROVIDER '${rawProvider}' is invalid. Supported values: 'pollinations', 'openrouter', 'openai'.`);
    }
  }
};

module.exports = imageGenerator;
