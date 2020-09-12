import {useState,useEffect} from 'react'
import {queryGraphQL} from '../lib/graphql'
import {useRouter} from 'next/router'

export function Chat(){
	const router=useRouter();
	let phone=router.query.phone!==undefined?router.query.phone:'';
	const setPhone=(thePhone)=>{
		router.push({
			pathname:'/chat',
			query:{
				phone:thePhone
			}
		})
	}
	const [results,setResults]=useState({
		allSentTexts:[],
		allRecivedTexts:[]
	});
	
	const fetchData=async()=>{
			let res=await queryGraphQL(`
			query ($phone: String!){
				allSentTexts(where:{to:$phone}){
					content,
					twilID,
					to,
					date,
					status,
					id
				}
				allRecivedTexts(where:{from:$phone}){
					content,
					twilID,
					from,
					date,
					id
				}
			}
			`,{phone:phone});
	setResults(res.data);
	return res.data;
}

const sendText=async(content)=>{
	let res=await queryGraphQL(`
			mutation ($phone: String!,$content: String!){
				sentText(number:$phone,content:$content){
				  content,
				  failedToSend
				}
			  }
			`,{phone:phone,content:content});
	return res.data;
}

useEffect(()=>{
	fetchData()
	
},[phone]);

const getNumTexts=()=>{
	console.log(results)
	return results.allRecivedTexts.length+results.allSentTexts.length;
}

useEffect(()=>{
	let timer=setInterval(async ()=>{
		console.log('updating');
		
		fetchData()
		
		
		
	},(Math.floor(Math.random()*10)+5)*1000);


	return ()=>{clearInterval(timer)};
},[phone])
	return <div>
		<input type="text" value={phone} onChange={(ev)=>{setPhone(ev.target.value)}}/> {phone}
		<Conversation sent={results.allSentTexts} received={results.allRecivedTexts} sendText={sendText} fetchData={fetchData}/>
		
	</div>
}

function Conversation(props){
	let messages=props.sent.map((el)=>{
		return {...el,TYPE:'SENT'}
	}).concat(props.received.map((el)=>{
		return {...el,TYPE:'RECEIVED'}
	})).sort((a,b)=>{
		return (new Date(a.date)).getTime()-(new Date(b.date)).getTime()
	});

	let theMessages=messages.map((el)=>{
		return <Message key={el.id} message={el}/>
	})

return <div>
		{theMessages}
		<TextBox sendText={props.sendText} fetchData={props.fetchData}/>
	</div>
}

function Message(props){
	let margin=props.message.TYPE==='SENT'?' 1rem 1rem 1rem auto':'1rem auto 1rem 1rem';
	let bgColor=props.message.TYPE==='SENT'?'rgb(200,255,255)':'rgb(200,255,200)';
	let opacity=(props.message.TYPE==='SENT'&&props.message.status!=='delivered')?'0.5':'1'

	let date=new Date(props.message.date);
	return <div title={date.toLocaleString()} style={
		{
			margin:margin, 
			backgroundColor:bgColor,
			maxWidth:'70vw',
			padding:'2rem',
			borderRadius:'2rem',
			width:'max-content',
			opacity:opacity,
			transition:'opacity 0.5s linear'
		}
	
	}>
		{props.message.content}
	</div>
}
function TextBox(props){
	const [textToSend,setTextToSend]=useState('');
	return <div  style={{display:'flex' , position:'sticky',bottom:'0rem'}}>
			<textarea style={{maxWidth:'50vh',width:'80rem',height:'5rem', marginLeft:'auto'}}
			value={textToSend} 
			onChange={(ev)=>{
				setTextToSend(ev.target.value);
			}}/>
			<button style={{height:'5rem', }} onClick={async ()=>{
				try{
					let message=await props.sendText(textToSend);
					console.log(message);
					if(message.sentText.failedToSend){
						alert('Failed To Send! Have they Refused to recive Mesages?');
					}
					else{
						setTextToSend('');
						await props.fetchData();
						window.scrollTo(0,document.body.scrollHeight);
					}
					
				}
				catch(err){
					console.log(err)
					alert('Failed To Send!');
				}
				
				
				}}> Send</button>
		</div>
}