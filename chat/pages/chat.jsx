import dynamic from 'next/dynamic';

const DynamicChat=dynamic(async ()=>{
	return (await import('../components/Chat')).Chat
},{ssr:false});


function ChatPage(){
	return 	(<>
		<style jsx global>{`
			body{
				margin:0
			}
		`}</style>
		<DynamicChat/>
	</>);
}

export default ChatPage;