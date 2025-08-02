import axios from "axios";
import { BACKEND_URL } from "../config";
import ChatRoomCllient from "./ChatRoomCllient";

async function getChats(roomId: string) {
  const response = await axios.get(`${BACKEND_URL}/chats/${roomId}`);

  return response.data.messages;
}

export default async function ChatRoom({ id }: { id: string }) {
  const messages = await getChats(id);

  return <ChatRoomCllient id={id} messages={messages} />;
}
