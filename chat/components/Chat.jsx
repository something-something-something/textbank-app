import {useState,useEffect,useRef} from 'react'
import {queryGraphQL} from '../lib/graphql'
import {useRouter} from 'next/router'
import styles from './Chat.module.css'
export function Chat(){
	const [textToSend,setTextToSend]=useState('');
	const router=useRouter();
	const [notificationPerm,setNotificationPerm]=useState(Notification.permission)
	
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
	

	const noteifications= (originalContacts,updateContacts)=>{
		if(Notification.permission==='granted'){



			updateContacts.forEach(async(con)=>{
				// console.log('running');
				// console.log(con.lastText)
				// console.log(originalContacts);
				if(originalContacts.some((oldc)=>{
					// console.log(oldc);
					// console.log(con);	
					return oldc.id===con.id&&oldc.lastText!==con.lastText;
				
				})){
					// console.log('potential noteification')
					
					let contact=con;
					console.log('scaning')
					let cres=await queryGraphQL(`
						query($cid: ID!){
							Contact(where:{id:$cid}){
								receivedTexts{
									id
									date
									content
								}
							}
						}
					`,{
						cid:contact.id
					});
					console.log(cres);
					let text=cres.data.Contact.receivedTexts.find((rt)=>{ 
						
						return (new Date(rt.date)).getTime()=== contact.lastText
					
					});
					if(text!==undefined){
						new Notification(contact.name+': '+text.content);
					}
						
					
				}
			})
		}
	}
	const prevContactsRef=useRef();
	useEffect(()=>{
		prevContactsRef.current=results.Script.contacts.map((el)=>{return el})
		
	})
	


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
						name
						firstName
						lastName
						middleName
						id
						lastText
						doNotContact
						completed
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
						doNotContact
						completed
						language
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
		noteifications( prevContactsRef.current,res.data.Script.contacts)
		

		
		setResults(res.data);
		return res.data;
	}




	const sendText=async(content)=>{
		let res=await queryGraphQL(`
				mutation ($contact: ID!,$content: String!){
					sendText(contact:$contact,content:$content){
					content,
					failedToSend
					}
				}
				`,{contact:contactID,content:content});
		return res.data;
	}

	useEffect(()=>{

		
		
	},[scriptID,contactID]);

	const getNumTexts=()=>{
		console.log(results)
		return results.allReceivedTexts.length+results.allSentTexts.length;
	}
	const requestNotificationPermision=async()=>{
		console.log('Not?')
		await Notification.requestPermission();
		if(Notification.permission==='granted'){
			new Notification('In order to recive notifications please leave the tab open');
		}
		setNotificationPerm(Notification.permission);
	}
	


	useEffect(()=>{
		if(scriptID!==''){
			fetchData();
		
			let timer=setInterval(async ()=>{
				console.log('updating');
				
				fetchData()
				
				
			},(Math.floor(Math.random()*10)+5)*1000);


			return ()=>{clearInterval(timer)};
		}
	},[scriptID,contactID])

	

	let textReplacmentData={
		contact:{}
	}
	if(results.Script.selectedContact!==undefined){
		textReplacmentData.contact.firstName=results.Script.selectedContact[0].firstName;
	}

	return <div className={styles.Chat}>
		<div className={styles.chatHeader}>
			<a href="/">&larr;</a>
			{ (notificationPerm==='default')&&(<button onClick={requestNotificationPermision}>Notify Me </button>)}
			{results.Script.name}
			{results.Script.selectedContact!==undefined&&(
				<> - 

					{results.Script.selectedContact[0].name}
				
				</>
			)}
		</div>
		<ContactsBar contacts={results.Script.contacts} setContact={setContact} contactID={contactID}/>
		
		{results.Script.selectedContact!==undefined&&(
			<>
			<Script lines={results.Script.scriptLines} setTextToSend={setTextToSend} contact={results.Script.selectedContact[0]} textReplacmentData={textReplacmentData} fetchData={fetchData}/>
			<ScriptQuestions questions={results.Script.questions} contact={results.Script.selectedContact[0]} fetchData={fetchData}/>
			<Conversation sent={results.Script.selectedContact[0].sentTexts} received={results.Script.selectedContact[0].receivedTexts} sendText={sendText} fetchData={fetchData}/>

			<TextBox textToSend={textToSend} setTextToSend={setTextToSend} sendText={sendText} fetchData={fetchData} contact={results.Script.selectedContact[0]}/>
			</>
		)}
		
	</div>
}
function ContactsBar(props){
	const [searchText,setSearchText]=useState('');
	return (<div className={styles.contactsBar}>
		
		<input className={styles.contactSearch} value={searchText} onChange={(ev)=>{setSearchText(ev.target.value)}} type="text" placeholder="Search Contacts"/>
		{props.contacts.concat([]).sort((a,b)=>{
			return b.lastText - a.lastText;
		}).filter((el)=>{
			if(searchText===''){
				return true;
			}

			let splitText=searchText.split(' ').filter((sw)=>{
				return sw!=='';
			});
			return splitText.reduce((acc,curr)=>{
				let b=false;
				if(el.firstName.includes(curr)){
					b=true;
				}
				if(el.middleName.includes(curr)){
					b=true;
				}
				if(el.lastName.includes(curr)){
					b=true;
				}

				return acc||b;
			},false);

		}).map((el)=>{

			let classes=[styles.contactButton]
			if(el.completed){
				classes.push(styles.contactButtonCompleted);
			}
			
			if(el.doNotContact){
				classes.push(styles.contactButtonDNC);
			}
			if(el.id===props.contactID){
				classes.push(styles.contactButtonSelected);
			}


			return (<button key={el.id} onClick={()=>{props.setContact(el.id)}}
			className={classes.join(' ')}
			>
				{el.name}
			</button>);
		})}
	</div>);
}
function Script(props){
	const switchLanguage=async (lang)=>{
		await queryGraphQL(`
			mutation($cid:ID!,$lang:ContactLanguageType!){
				updateContact(id:$cid,data:{
					language:$lang
				}){
					id
				}
			}
		`,{
			cid:props.contact.id,
			lang:lang
		});

		props.fetchData();
	};

	return (<div style={{gridArea:'script',overflow:'auto'}}> 
		Language:<select value={props.contact.language} onChange={(ev)=>{switchLanguage(ev.target.value)}}>
			<option value="en">English</option>
			<option value="es">Spanish</option>
		</select>
		{props.lines.filter((el)=>{
			return el.parent===null;
		}).sort((a,b)=>{
			return a.order-b.order;
		}).map((el)=>{
			return <ScriptLine key={el.id} line={el} lines={props.lines} setTextToSend={props.setTextToSend} textReplacmentData={props.textReplacmentData} contact={props.contact} />
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
	let lineText=props.contact.language==='en'?props.line.en:props.line.es;

	return (<div>
		<b>{props.line.instructions}</b>
		<div>{fillReplacements(lineText)}</div>
		<button onClick={()=>{
			props.setTextToSend(fillReplacements(lineText));
		}}>Text</button>
		<div style={{marginLeft:'2rem'}}>
			{props.lines.filter((el)=>{
				return el.parent!==null&&el.parent.id===props.line.id;
			}).sort((a,b)=>{
				return a.order-b.order;
			}).map((el)=>{
				return <ScriptLine key={el.id} line={el} lines={props.lines} setTextToSend={props.setTextToSend} textReplacmentData={props.textReplacmentData} contact={props.contact} />
			})}
		</div>
	</div>);
}
function ScriptQuestions(props){
	const toggleDoNotContact=async()=>{
		await queryGraphQL(`
			mutation($contact:ID!){
				toggleDoNotContact(contact:$contact){
					success
				}
			}
		
		`,{
			contact:props.contact.id
		});

		props.fetchData();
	}
	const toggleCompleted=async()=>{
		await queryGraphQL(`
		mutation($cid:ID!,$status:Boolean!){
			updateContact(id:$cid,data:{
				completed:$status
			}){
				id
			}
		}
	`,{
		cid:props.contact.id,
		status:!props.contact.completed
	});

		props.fetchData();
	}


	return (<div style={{gridArea:'questions',overflow:'auto'}}> 
		Questions<br/>
		{props.contact.completed?'COMPLETED!':'INCOMPLETE'}
		<button onClick={toggleCompleted}>{props.contact.completed?'Mark incomplete':'mark complete'}</button>
		<div>
			Has Contact requested not to be Contacted? 
			<br/>{props.contact.doNotContact?'Yes':'No'}
			<button onClick={toggleDoNotContact}>
			{props.contact.doNotContact?'Remove From Do Not Contact':'Add to Do Not Contact'}
			</button> 
		</div>
		
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
	//move restriction serverside
	if(props.contact.doNotContact){
		return(<div  style={{gridArea:'textbox'}}>
			User Is marked as Do Not Contact
		</div>);
	}

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
					if(message.sendText.failedToSend){
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