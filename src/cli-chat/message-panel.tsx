import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "./chat.js";

interface MessagePanelProps {
    messages: ChatMessage[];
}

export const MessagePanel: React.FC<MessagePanelProps> = ({ messages }) => (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {messages.length === 0 ? (
            <Text dimColor>No messages yet. Start typing below.</Text>
        ) : (
            messages.map((msg, i) => (
                <Box key={i} marginBottom={1}>
                    <Text bold color={msg.role === "user" ? "cyan" : "green"}>
                        {msg.role === "user" ? "You: " : "AI: "}
                    </Text>
                    <Text wrap="wrap">{msg.content}</Text>
                </Box>
            ))
        )}
    </Box>
);
