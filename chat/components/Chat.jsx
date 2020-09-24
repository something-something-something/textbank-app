import {useState,useEffect} from 'react'
import {queryGraphQL} from '../lib/graphql'
import {useRouter} from 'next/router'

export function Chat(){
	const [textToSend,setTextToSend]=useState('');
	const router=useRouter();
	let contactID=router.query.contact!==undefined?router.query.contact:''
	
	let scriptID=router.query.script!==undefined?router.query.script:''

	const setContact=(cid)=>{
		setTextToSend('')
		router.push({
			pathname:'/chat',
			query:{
				contact:cid,
				script:scriptID
			}
		})
	}
	const [results,setResults]=useState({
		Script:{
			scriptLines:[],
			contacts:[]
		}
	});
	
	const fetchData=async()=>{
			let res=await queryGraphQL(`
			query ($script: ID!,$contact: ID!, $contactSelected: Boolean!){
				authenticatedUser{
					id
					email
				}
				Script(where:{id:$script}){
					name
					contacts{
						name,
						id
					}
					scriptLines{
						id
						instructions
						order
						en
						es
						parent{
							id
						}
						children{
							id
						}
					}
					questions{
						id
						questionText

					}
				 	selectedContact: contacts(where:{id:$contact})	@include(if: $contactSelected){
						id
						name
						firstName
						sentTexts{
							id
							content
							date
							status
						},
						receivedTexts{
							id
							content
							date
						}
						answers{
							id
							answerText
							question{
								id
							}
						}
					}
				}
				
			}
			`,{
				script:scriptID,
				contact:contactID,
				contactSelected: (contactID!=='')
			});

			if(res.data.authenticatedUser===null){
				window.location.pathname='/login';
			}
		setResults(res.data);
		return res.data;
	}

	const sendText=async(content)=>{
		let res=await queryGraphQL(`
				mutation ($contact: ID!,$content: String!){
					sentText(contact:$contact,content:$content){
					content,
					failedToSend
					}
				}
				`,{contact:contactID,content:content});
		return res.data;
	}

	useEffect(()=>{
		fetchData()
		
	},[scriptID,contactID]);

	const getNumTexts=()=>{
		console.log(results)
		return results.allReceivedTexts.length+results.allSentTexts.length;
	}

	useEffect(()=>{
		let timer=setInterval(async ()=>{
			console.log('updating');
			
			fetchData()
			
			
			
		},(Math.floor(Math.random()*10)+5)*1000);


		return ()=>{clearInterval(timer)};
	},[scriptID,contactID])

	let textReplacmentData={
		contact:{}
	}
	if(results.Script.selectedContact!==undefined){
		textReplacmentData.contact.firstName=results.Script.selectedContact[0].firstName;
	}

	return <div style={{
			margin:'0px',
			display:'grid',
			gridTemplateAreas:`
				"cbar header header"
				"cbar script questions"
				"cbar conv conv"
				"cbar textbox textbox"
			`,
			gridTemplateColumns:'10rem 1fr 1fr',
			gridTemplateRows:'5vh 35vh 45vh 10vh',
			rowGap:'0px',
			overflow:'hidden'
			
	}}>
		<div style={{gridArea:'header',fontSize:'4vh',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
			{results.Script.name}
			{results.Script.selectedContact!==undefined&&(
				<> - {results.Script.selectedContact[0].name}</>
			)}
		</div>
		<ContactsBar contacts={results.Script.contacts} setContact={setContact}/>
		<Script lines={results.Script.scriptLines} setTextToSend={setTextToSend} textReplacmentData={textReplacmentData}/>
		{results.Script.selectedContact!==undefined&&(
			<>
			<ScriptQuestions questions={results.Script.questions} contact={results.Script.selectedContact[0]} fetchData={fetchData}/>
			<Conversation sent={results.Script.selectedContact[0].sentTexts} received={results.Script.selectedContact[0].receivedTexts} sendText={sendText} fetchData={fetchData}/>

			<TextBox textToSend={textToSend} setTextToSend={setTextToSend} sendText={sendText} fetchData={fetchData}/>
			</>
		)}
		
	</div>
}
function ContactsBar(props){
	
	return (<div style={{gridArea:'cbar',overflow:'auto'}}>
		{props.contacts.map((el)=>{
			return (<button key={el.id} onClick={()=>{props.setContact(el.id)}}
			style={{
				display:'block',
				width:'100%'
			}}
			>
				{el.name}
			</button>);
		})}
	</div>);
}
function Script(props){
	return (<div style={{gridArea:'script',overflow:'auto'}}> 
		{props.lines.filter((el)=>{
			return el.parent===null;
		}).sort((a,b)=>{
			return a.order-b.order;
		}).map((el)=>{
			return <ScriptLine key={el.id} line={el} lines={props.lines} setTextToSend={props.setTextToSend} textReplacmentData={props.textReplacmentData}/>
		})}
	</div>);
}
function ScriptLine(props){

	let fillReplacements=(text)=>{
		let replacedText=text;
		if(props.textReplacmentData.contact.firstName!==undefined){
			replacedText=replacedText.replaceAll('{ContactFirstName}',props.textReplacmentData.contact.firstName);
			replacedText=replacedText.replaceAll('{VoterName}',props.textReplacmentData.contact.firstName);
		}
		return replacedText
	}
	return (<div>
		<b>{props.line.instructions}</b>
		<div>{fillReplacements(props.line.en)}</div>
		<button onClick={()=>{
			props.setTextToSend(fillReplacements(props.line.en));
		}}>Text</button>
		<div style={{marginLeft:'2rem'}}>
			{props.lines.filter((el)=>{
				return el.parent!==null&&el.parent.id===props.line.id;
			}).sort((a,b)=>{
				return a.order-b.order;
			}).map((el)=>{
				return <ScriptLine key={el.id} line={el} lines={props.lines} setTextToSend={props.setTextToSend} textReplacmentData={props.textReplacmentData}/>
			})}
		</div>
	</div>);
}
function ScriptQuestions(props){
	return (<div style={{gridArea:'questions',overflow:'auto'}}> 
		Questions<br/>
		{props.questions.map((el)=>{
			return <div key={el.id}>
				{el.questionText}
				<ScriptQuestionNewAnswer question={el} contact={props.contact} fetchData={props.fetchData}/>
				{props.contact.answers.filter((ans)=>{
					return ans.question.id===el.id;
				}).map((ans)=>{
					return <ScriptQuestionAnswer key={ans.id} answer={ans} fetchData={props.fetchData}/>
				})
				
				
				}
			</div>
		})}
	</div>);
}
function ScriptQuestionNewAnswer(props){
	let makeAnswer=async ()=>{
		await queryGraphQL(`
			mutation ($contact: ID!,$question:ID!){
				createScriptAnswer(data:{
					contact:{
						connect:{
							id:$contact
						}
					},
					question:{
						connect:{
							id:$question
						}
					}
				}){
					id
				}
			}
		`,
		{
			contact:props.contact.id,
			question:props.question.id
		});
		props.fetchData();
	}
	return (<button onClick={()=>{makeAnswer()}}>New Answer</button>);
}
function ScriptQuestionAnswer(props){
	const [answerText,setAnswerText]=useState(props.answer.answerText)
	let needsSave=false;
	if(answerText!==props.answer.answerText){
		needsSave=true;
	}

	const save=async ()=>{
		await queryGraphQL(`
			mutation ($id: ID!,$text:String!){
				updateScriptAnswer(id:$id,data:{
					answerText:$text
				}){
					id
				}
			}
		`,
		{
			id:props.answer.id,
			text:answerText
		});
		props.fetchData();
	}
	return (<div> 
		{needsSave&&(
			<button onClick={()=>{
				save();
			}}>Save</button>
		)}
		<textarea value={answerText} onChange={(ev)=>{setAnswerText(ev.target.value)}}/>
	</div>);
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

	return <div style={{gridArea:'conv',overflow:'auto'}}>
		{theMessages}
		
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
	
	return <div  style={{gridArea:'textbox',display:'flex'}}>
			<textarea style={{maxWidth:'50vh',width:'80rem', marginLeft:'auto'}}
			value={props.textToSend} 
			onChange={(ev)=>{
				props.setTextToSend(ev.target.value);
			}}/>
			<button style={{}} onClick={async ()=>{
				try{
					let message=await props.sendText(props.textToSend);
					console.log(message);
					if(message.sentText.failedToSend){
						alert('Failed To Send! Have they Refused to recive Mesages?');
					}
					else{
						props.setTextToSend('');
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