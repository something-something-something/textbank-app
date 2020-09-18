import dynamic from 'next/dynamic';

const DynamicChat=dynamic(async ()=>{
	return (await import('../components/Chat')).Chat
},{ssr:false});

function ChatPage(){
	return 	<DynamicChat/>
}

export default ChatPage;