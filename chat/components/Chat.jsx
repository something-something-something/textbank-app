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
						let note=new Notification(contact.name+': '+text.content);
						note.onclick=(ev)=>{
							window.focus()
							setContact(contact.id);
						};
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
					nickName
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
						questions{
							id
							questionText
							suggestedOptions
						}
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
				
				
			},(Math.floor(Math.random()*10)+10)*1000);


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
			<Script idPrefix='main-script' lines={results.Script.scriptLines} setTextToSend={setTextToSend} contact={results.Script.selectedContact[0]} user={results.authenticatedUser} textReplacmentData={textReplacmentData} fetchData={fetchData}/>
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
			if(a.doNotContact&&!b.doNotContact){
				return 1;
			}
			if(b.doNotContact&&!a.doNotContact){
				return -1;
			}
			if(a.completed&&!b.completed){
				return 1;
			}
			if(b.completed&&!a.completed){
				return -1
			}
			if(a.lastText===0&&b.lastText!==0){
				return -1;
			}
			if(b.lastText===0&&a.lastText!==0){
				return 1;
			}

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
			if(el.lastText===0){
				classes.push(styles.contactButtonNeverContacted);
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
	const [nickName,setNickName]=useState(props.user.nickName);

	if(nickName!==props.user.nickName){

	}
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

	const updateNickName=async ()=>{
		await queryGraphQL(`
			mutation($uid:ID!,$nick:String!){
				updateUser(id:$uid,data:{
					nickName:$nick
				}){
					id
				}
			}
		
		`,{
			uid:props.user.id,
			nick:nickName,
		});

		props.fetchData();
	};

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
	




	return (<div style={{gridArea:'script',overflow:'auto'}}> 
		Your nickname:<input value={nickName} onChange={(ev)=>{setNickName(ev.target.value)}}/>
		{nickName!==props.user.nickName&&(<button onClick={updateNickName}>Save</button>)}
		<br/><br/>
		<ContactCompletedStatus contact={props.contact} fetchData={props.fetchData}/>
		<div>
			Has Contact requested not to be Contacted? 
			<br/>{props.contact.doNotContact?'Yes':'No'}
			<button onClick={toggleDoNotContact}>
			{props.contact.doNotContact?'Remove From Do Not Contact':'Add to Do Not Contact'}
			</button> 
		</div>

		<br/>
		Language:<select value={props.contact.language} onChange={(ev)=>{switchLanguage(ev.target.value)}}>
			<option value="en">English</option>
			<option value="es">Spanish</option>
		</select>
		
		<br/>
		<br/>

		{props.lines.filter((el)=>{
			return el.parent===null;
		}).sort((a,b)=>{
			return a.order-b.order;
		}).map((el,index,arr)=>{
			let nextScriptLine=false;
			if(index+1<arr.length){
				nextScriptLine=arr[index+1];
			}
			return <ScriptLine idPrefix={props.idPrefix} key={el.id} line={el} nextScriptLine={nextScriptLine} lines={props.lines} setTextToSend={props.setTextToSend}  contact={props.contact} user={props.user} fetchData={props.fetchData}/>
		})}
		<div className={styles.contactCompleteReminder}>
			Don't forget to mark this contact Complete!
			<ContactCompletedStatus contact={props.contact} fetchData={props.fetchData}/>
		</div>
	</div>);
}

function ContactCompletedStatus(props){
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
	return <div>{props.contact.completed?'COMPLETED!':'INCOMPLETE'}
		<button onClick={toggleCompleted}>{props.contact.completed?'Mark incomplete':'mark complete'}</button></div>
}

function ScriptLine(props){

	let fillReplacements=(text)=>{
		let replacedText=text;
		if(props.contact.firstName!==undefined){
			replacedText=replacedText.replaceAll('{ContactFirstName}',props.contact.firstName);
			replacedText=replacedText.replaceAll('{VoterName}',props.contact.firstName);
		}
		if(props.user.nickName!==null||props.user.nickName!==''){
			replacedText=replacedText.replaceAll('{UserNickName}',props.user.nickName);
			replacedText=replacedText.replaceAll('{VolunteerName}',props.user.nickName);
			replacedText=replacedText.replaceAll('{SenderName}',props.user.nickName);
		}

		return replacedText
	}
	let lineText=props.contact.language==='en'?props.line.en:props.line.es;

	let childrenLines=props.lines.filter((el)=>{
			return el.parent!==null&&el.parent.id===props.line.id;
		}).sort((a,b)=>{
			return a.order-b.order;
		});

	return (<div>
		<div id={props.idPrefix+'-scriptline-'+props.line.id} className={styles.scriptLineContent} >
			<b>{props.line.instructions}</b>
			<div>{fillReplacements(lineText)}</div>
			<button className={styles.scriptLineTextButton} onClick={()=>{
				props.setTextToSend(fillReplacements(lineText));
			}}>Text This Line</button>
			{props.line.questions.length>0&&<ScriptQuestions contact={props.contact} questions={props.line.questions} fetchData={props.fetchData}/>}
		
			{props.nextScriptLine&&childrenLines.length>0&&(
				<>
					If none of the following apply: <a className={styles.scriptLineSkipNext} href={'#'+props.idPrefix+'-scriptline-'+props.nextScriptLine.id}>Skip to {props.nextScriptLine.instructions}</a>
				</>
			)}
			


		</div>

		<div style={{marginLeft:'4rem'}}>
			{childrenLines.map((el)=>{
				return <ScriptLine key={el.id}  idPrefix={props.idPrefix} line={el} lines={props.lines} setTextToSend={props.setTextToSend} contact={props.contact} user={props.user} fetchData={props.fetchData}/>
			})}
		</div>
	</div>);
}
function ScriptQuestions(props){
	

	return (<div className={styles.scriptQuestions}> 
		{/* {props.questions.length>1?'Questions':'Question'}: */}
		
		
		{props.questions.map((el)=>{
			return <div key={el.id} className={styles.scriptQuestion}>
				<div  className={styles.scriptQuestionText}>{el.questionText}</div>
				<div style={{textAlign:'right'}}>
					{el.suggestedOptions.split(',').filter((op)=>{
						return op.trim()!=='';
					}).map((op)=>{
						return <ScriptQuestionNewAnswer key={op} question={el} contact={props.contact} fetchData={props.fetchData} answerText={op.trim()}/>	
					})}
					
					<ScriptQuestionNewAnswer question={el} contact={props.contact} fetchData={props.fetchData} answerText=""/>
				</div>
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
			mutation ($contact: ID!,$question:ID!,$text:String!){
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
					},
					answerText:$text
				}){
					id
				}
			}
		`,
		{
			contact:props.contact.id,
			question:props.question.id,
			text:props.answerText
		});
		props.fetchData();
	}
	return (<button className={styles.scriptLineButton} onClick={()=>{makeAnswer()}}>{props.answerText===''?'Custom Answer':props.answerText}</button>);
}
function ScriptQuestionAnswer(props){
	const [answerText,setAnswerText]=useState(props.answer.answerText);
	const [editMode,setEditMode]=useState(false)
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
		setEditMode(false);
		props.fetchData();
	}

	const deleteAnswer=async()=>{
		await queryGraphQL(`
			mutation ($id: ID!){
				deleteScriptAnswer(id:$id){
					id
				}
			}
		`,
		{
			id:props.answer.id,
		});
		props.fetchData();
	}
	return (<div className={styles.scriptAnswer}> 
		{!editMode&&(<>
			{props.answer.answerText!==''
			?
				<>{props.answer.answerText}</>
			:
				<b>Click Edit to provide an answer</b>
			}
			</>)
			
		}
		{editMode&&<>
			<textarea value={answerText} onChange={(ev)=>{setAnswerText(ev.target.value)}}/>
			<br/>{needsSave&&(
				<button onClick={()=>{
					save();
				}}>Save</button>
			)}
		</>}
		<button onClick={()=>{
			setAnswerText(props.answer.answerText);
			setEditMode(!editMode); 
		}}>{editMode?'Cancel':'edit'}</button>
		<button onClick={deleteAnswer}>Delete</button>
	
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
	let bgColor=props.message.TYPE==='SENT'?'rgb(200,230,255)':'rgb(200,255,200)';
	let opacity=(props.message.TYPE==='SENT'&&props.message.status!=='delivered')?'0.5':'1'

	
	let date=new Date(props.message.date);
	let titleText=date.toLocaleString();

	if(props.message.TYPE==='SENT'){
		titleText=titleText+' '+props.message.status;
	}
	return <div title={titleText} style={
		{
			margin:margin, 
			backgroundColor:bgColor,
			// maxWidth:'70vw',
			padding:'2rem',
			borderRadius:'2rem',
			width:'max-content',
			maxWidth:'50%',
			opacity:opacity,
			whiteSpace:'pre-wrap',
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
			<textarea style={{maxWidth:'100%',width:'80rem', marginLeft:'auto',resize:'none'}}
			value={props.textToSend} 
			onChange={(ev)=>{
				props.setTextToSend(ev.target.value);
			}}/>
			<button className={styles.sendTextButton} onClick={async ()=>{
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