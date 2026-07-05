import * as baileys from "@whiskeysockets/baileys";

const { generateWAMessageFromContent } = baileys;

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
  // If already formatted, return as is
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

    // Handle buttons
    const buttons = normalizeButtons(content.buttons || []);
    
    const interactive = {
      header: {
        title: content.header || content.title || "",
        subtitle: content.subtitle || ""
      },
      body: { 
        text: content.body || content.text || content.caption || "" 
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

    // If there's an image, send as image message with buttons
    if (content.image) {
      const msg = await sock.sendMessage(jid, {
        image: content.image,
        caption: content.caption || content.text || ""
      });
      
      // Then send the button message separately
      const buttonMsg = generateWAMessageFromContent(
        jid,
        { interactiveMessage: interactive },
        { userJid: sock.user?.id, ...options }
      );
      
      await sock.relayMessage(jid, buttonMsg.message, { 
        messageId: buttonMsg.key.id, 
        additionalNodes: INTERACTIVE_NODES 
      });
      
      return buttonMsg;
    }

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