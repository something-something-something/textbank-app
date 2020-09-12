import dynamic from 'next/dynamic';

const DynamicChat=dynamic(async ()=>{
	return (await import('../components/Chat')).Chat
},{ssr:false});

function ChatPage(){
	return <div>
		Chat App
		<DynamicChat/>
	</div>
}

export default ChatPage;