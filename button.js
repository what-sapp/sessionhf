import * as baileys from "@whiskeysockets/baileys";

const { generateWAMessageFromContent, prepareWAMessageMedia } = baileys;

const INTERACTIVE_NODES = [
  {
    tag: "biz",
    attrs: {},
    content: [
      {
        tag: "interactive",
        attrs: { type: "native_flow", v: "1" },
        content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }]
      }
    ]
  }
];

function toNativeFlow(button) {
  if (button?.name && button?.buttonParamsJson) return button;
  
  // Handle URL button
  if (button.type === "url" || button.url) {
    return {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: button.text || "🔗 Open",
        url: button.url,
        merchant_url: button.url
      })
    };
  }
  
  // Handle copy button
  if (button.type === "copy" || button.copy) {
    return {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({
        display_text: button.text || "📋 Copy",
        id: button.id || button.copy || "copy_key",
        copy_code: button.copy || button.code || ""
      })
    };
  }
  
  // Default to quick reply
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: button.text || "Click",
      id: button.id || button.text || "btn"
    })
  };
}

const normalizeButtons = (list = []) => list.map(toNativeFlow);

export function bindButton(sock) {
  sock.sendButton = async (jid, content = {}, options = {}) => {
    const contextInfo = {
      mentionedJid: content.mentions || [],
      ...(content.contextInfo || {})
    };

    const buttons = normalizeButtons(content.buttons || []);
    
    // Prepare media if image is provided
    let imageMessage = null;
    if (content.image) {
      const media = await prepareWAMessageMedia(
        { image: content.image },
        { upload: sock.waUploadToServer }
      );
      imageMessage = media.imageMessage;
    }

    // Build interactive message with image header if available
    const interactive = {
      header: imageMessage ? {
        hasMediaAttachment: true,
        imageMessage: imageMessage
      } : {
        title: content.header || content.title || "",
        subtitle: content.subtitle || ""
      },
      body: { 
        text: content.caption || content.body || content.text || "" 
      },
      footer: { 
        text: content.footer || "" 
      },
      nativeFlowMessage: { 
        buttons, 
        messageVersion: 1 
      },
      contextInfo
    };

    const msg = generateWAMessageFromContent(
      jid,
      { interactiveMessage: interactive },
      { userJid: sock.user?.id, ...options }
    );
    
    await sock.relayMessage(jid, msg.message, { 
      messageId: msg.key.id, 
      additionalNodes: INTERACTIVE_NODES 
    });
    
    return msg;
  };

  return sock;
}

export default bindButton;