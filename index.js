const {Keystone}=require('@keystonejs/keystone');
const {MongooseAdapter}=require('@keystonejs/adapter-mongoose');
const {GraphQLApp}=require('@keystonejs/app-graphql');
const {Text,DateTimeUtc, Relationship, Integer,Virtual, Select, Password, Checkbox} =require('@keystonejs/fields');
const { createItem ,getItems,updateItem,getItem,deleteItem} = require('@keystonejs/server-side-graphql-client');
const {NextApp} =require('@keystonejs/app-next');
const {PasswordAuthStrategy}=require('@keystonejs/auth-password')
const twilioClient=require('twilio')(process.env.TWILSID,process.env.TWILAUTHTOKEN);
const {AuthUserIsAdmin,AuthUserIsVolunteer,AuthUserIsAdminOrVolunteer,AuthUserIsScriptUser,AuthUserIsAuthedForScriptAnswerList,AuthUserIsAuthedForContacList,AuthUserHasArgContactForCustomSchema,AuthUserIsAuthedForUserList}=require('./access');
const crypto=require('crypto');
const bycrypt=require('bcryptjs');
const nodemailer=require('nodemailer');

const mail=require('./mail');



function serverContext(keystone){ 
	return keystone.createContext({skipAccessControl:true});
};


const keystone=new Keystone({
	adapter: new MongooseAdapter({mongoUri:process.env.URLMONGO}),
	cookie:{
		sameSite:'strict'
	},
	onConnect:()=>{
		console.log('connected');

		const addUserIfNone=async()=>{
			let users=await getItems({keystone,listKey:'User',returnFields:'id'});
			if(users.length===0){
				console.log('adding user');
				await createItem({
					keystone,
					listKey:'User',
					item:{
						email:'admin',
						password:'password',
						role:'admin'
					}
				})
			}
		};
		addUserIfNone();
		setInterval(async ()=>{
			console.log('Texts');
			let receivedMessages=await twilioClient.messages.list({to:process.env.TWILNUMBER});

			let storedReceivedMesages=await getItems({keystone,listKey:'ReceivedText',returnFields:'id, content, from, twilID'});

			for(let rm of receivedMessages){
				//console.log(rm)
				if(!storedReceivedMesages.some((el)=>{return el.twilID===rm.sid})){
					createItem({
						keystone,
						listKey:'ReceivedText',
						item:{
							content:rm.body,
							from:rm.from,
							twilID:rm.sid,
							date:(new Date(rm.dateSent)).toISOString()
						},
					});
				}

			}
			//console.log(receivedMessages);


			let sentMessages=await twilioClient.messages.list({from:process.env.TWILNUMBER});
			let storedSentMesages=await getItems({keystone,listKey:'SentText',returnFields:'id, content, to, status, twilID'});
			for(let sm of sentMessages){
				//console.log(sm)
				if(!storedSentMesages.some((el)=>{return el.twilID ===sm.sid})){
					createItem({
						keystone,
						listKey:'SentText',
						item:{
							content:sm.body,
							to:sm.to,
							status:sm.status,
							twilID:sm.sid,
							date:(new Date(sm.dateCreated)).toISOString()
						},
					});
				}
				else{
					let storedMesage=storedSentMesages.find((el)=>{return el.twilID===sm.sid})
					if(storedMesage.status!==sm.status||storedMesage.content!==sm.body){
						updateItem({
							keystone,
							listKey:'SentText',
							item:{id:storedMesage.id,data:{status:sm.status,content:sm.body}},
						})
					}
				}
			}



		},15*1000);
	}
});


keystone.createList('Script',{
	access:{
		create:AuthUserIsAdmin,
		read:({authentication})=>{
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if(AuthUserIsVolunteer({authentication})){
				return {
					users:{
						id:authentication.item.id
					}
				}
			}
			return false;
		},
		update:AuthUserIsAdmin,
		delete:AuthUserIsAdmin
	},
	fields:{
		name:{
			type:Text,
			defaultValue:'',
		},
		scriptLines:{
			type:Relationship,
			ref:'ScriptLine.script',
			many:true,
		},
		contacts:{
			type:Relationship,
			ref:'Contact.script',
			many:true,
			// access:{
			// 	read:AuthUserIsScriptUser
			// }
		},
		questions:{
			type:Relationship,
			ref:'ScriptQuestion.script',
			many:true,
			// access:{
			// 	read:AuthUserIsScriptUser
			// }
		},
		users:{
			type:Relationship,
			ref:'User.scripts',
			many:true,
			access:{
				read:AuthUserIsAdmin
			}
		}
	}
});

keystone.createList('ScriptQuestion',{
	access:{
		create:AuthUserIsAdmin,
		read:async ({authentication,context})=>{
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if (AuthUserIsVolunteer({ authentication })) {
				try {
					let res = await context.executeGraphQL({
						context: context.createContext({ skipAccessControl: true }),
						query: `
						query($uID: ID!){
							User(where:{id:$uID}){
								scripts{
									id
								}
							}
						}
					
					`,
						variables: {
							uID: authentication.item.id
						}
					});
					let user = res.data.User;

					return {
						OR: user.scripts.map((el) => {
							return {
								script: {
									id: el.id
								}
							};
						})
					};

				}
				catch (e) {
					return false;
				}
				return false;
			}
			return false;
		},
		update:AuthUserIsAdmin,
		delete:AuthUserIsAdmin
	},
	fields:{
		questionText:{
			type:Text,
			defaultValue:''
		},
		headerName:{
			type:Text,
			isRequired:true
		},
		script:{
			type:Relationship,
			ref:'Script.questions',
			isRequired:true
		},
		answers:{
			type:Relationship,
			ref:'ScriptAnswer.question',
			many:true
		}
	}
});

keystone.createList('ScriptAnswer',{
	access:{
		create:async({authentication,context,originalInput})=>{
			//console.log(originalInput);
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if (AuthUserIsVolunteer({ authentication })) {
				if(
					originalInput.contact.create!==undefined||
					originalInput.question.create!==undefined||
					originalInput.contact.disconnect!==undefined||
					originalInput.question.disconnect!==undefined||
					originalInput.contact.disconnectAll!==undefined||
					originalInput.question.disconnectAll!==undefined
				){
					return false;
				}

				try {
					let res = await context.executeGraphQL({
						context: context.createContext({ skipAccessControl: true }),
						query: `
							query($uID: ID!){
								User(where:{id:$uID}){
									contacts{
										id
									}
									scripts{
										id
										questions{
											id
										}
									}
								}
							}
						`,
						variables: {
							uID: authentication.item.id
						}
					});
					let user = res.data.User;
					console.log('USER');
					console.log(user);
					if( 
						originalInput.contact.connect.id!==undefined&&
						originalInput.question.connect.id!==undefined
					){

						return user.contacts.some((c)=>{
							return c.id ===originalInput.contact.connect.id
						})&&user.scripts.some((s)=>{
							return s.questions.some((q)=>{
								return q.id===originalInput.question.connect.id;
							});
						});
					}
					

				}
				catch (e) {
					return false;
				}
			}
			return false;
		},
		read:AuthUserIsAuthedForScriptAnswerList,
		update:AuthUserIsAuthedForScriptAnswerList,
		delete:AuthUserIsAuthedForScriptAnswerList
	},
	fields:{
		contact:{
			type:Relationship,
			ref:'Contact.answers',
			isRequired:true,
			access:{
				update:AuthUserIsAdmin
			}
		},
		question:{
			type:Relationship,
			ref:'ScriptQuestion.answers',
			isRequired:true,
			access:{
				update:AuthUserIsAdmin
			}
		},
		answerText:{
			type:Text
		},
	}
});

keystone.createList('ScriptLine',{
	access:{
		create:AuthUserIsAdmin,
		read:async({authentication,context})=>{
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if (AuthUserIsVolunteer({ authentication })) {
				try {
					let res = await context.executeGraphQL({
						context: context.createContext({ skipAccessControl: true }),
						query: `
							query($uID: ID!){
								User(where:{id:$uID}){
									scripts{
										id
									}
								}
							}
						`,
						variables: {
							uID: authentication.item.id
						}
					});
					let user = res.data.User;

					return {
						OR: user.scripts.map((el) => {
							return {
								script: {
									id: el.id
								}
							};
						})
					};

				}
				catch (e) {
					return false;
				}
			}
			return false;
		},
		update:AuthUserIsAdmin,
		delete:AuthUserIsAdmin
	},
	fields:{
		script:{
			type:Relationship,
			ref:'Script.scriptLines'
		},
		instructions:{
			type:Text,
			defaultValue:''
		},
		order:{
			type:Integer,
			isUnique:true,
			defaultValue:async ()=>{
				let lines=await getItems({keystone,listKey:'ScriptLine',returnFields:'order'});
				return 1+lines.reduce((acc,curr)=>{
						return curr.order>acc?curr.order:acc;
				},0);
			}
		},
		en:{
			type:Text,
			defaultValue:''
		},
		es:{
			type:Text,
			defaultValue:''
		},
		parent:{
			type:Relationship,
			ref:'ScriptLine.children',
			
			
		},
		children:{
			type:Relationship,
			ref:'ScriptLine.parent',
			many:true
		}
	}
	
});

keystone.createList('SentText',{
	access:{
		create:()=>{return false},
		read:()=>{return false},
		update:()=>{return false},
		delete:()=>{return false}
	},
	fields:{
		content:{
			type:Text
		},
		to:{
			type:Text
		},
		date:{
			type:DateTimeUtc
		},
		status:{
			type:Text
		},
		twilID:{
			type:Text
		}
	}
});
keystone.createList('ReceivedText',{
	access:{
		create:()=>{return false},
		read:()=>{return false},
		update:()=>{return false},
		delete:()=>{return false}
	},
	fields:{
		content:{
			type:Text
		},
		from:{
			type:Text
		},
		date:{
			type:DateTimeUtc
		},
		twilID:{
			type:Text
		}
	}
});


keystone.createList('Contact',{
	access:{
		create:AuthUserIsAdmin,
		read:AuthUserIsAuthedForContacList,
		update:AuthUserIsAuthedForContacList,
		delete:AuthUserIsAdmin
	},
	fields:{
		script:{
			type:Relationship,
			ref:'Script.contacts',
			isRequired:true,
			access:{
				update:AuthUserIsAdmin,
			}
		},
		firstName:{
			type:Text,
			defaultValue:'',
			access:{
				update:AuthUserIsAdmin,
			}
		},
		middleName:{
			type:Text,
			defaultValue:'',
			access:{
				update:AuthUserIsAdmin,
			}
		},
		lastName:{
			type:Text,
			defaultValue:'',
			access:{
				update:AuthUserIsAdmin,
			}
		},
		name:{
			type:Virtual,
			resolver:(item)=>{
				if(item.middleName!==''){
					return item.firstName+' '+item.middleName+' '+item.lastName;
				}
				else{
					return item.firstName+' '+item.lastName;
				}
			}
		},
		doNotContact:{
			type:Virtual,
			graphQLReturnType:'Boolean',
			resolver:async (item)=>{
				try{
					let doNotContact=await getItems({keystone,listKey:'DoNotContactPhone',returnFields:'id',where:{phone:item.phone}});

					return doNotContact.length!==0
				}
				catch(err){
					console.log('Error contact.doNotContact issue')
					return true;
				}
				return true;
				
			}
		},
		lastText:{
			type:Virtual,
			graphQLReturnType:'Float',
			resolver:async (item)=>{
				try{
					let sent=await getItems({keystone,listKey:'SentText',returnFields:'date',where:{to:item.phone}});
					let received=await getItems({keystone,listKey:'ReceivedText',returnFields:'date',where:{from:item.phone}});
					let both=sent.concat(received);
					console.log(both);
					both=both.sort((a,b)=>{
						return (new Date(b.date)).getTime() - (new Date(a.date)).getTime();
					});

					if(both.length>0){
						return (new Date(both[0].date)).getTime();
					}
					else{
						return 0;
					}
				}
				catch(err){
					return 0;
				}
			}
		},
		completed:{
			type:Checkbox,
			defaultValue:false
		},
		vanid:{
			type:Text,
			defaultValue:'',
			access:{
				update:AuthUserIsAdmin,
				read:AuthUserIsAdmin
			}
		},

		phone:{
			type:Text,
			access:{
				update:AuthUserIsAdmin,
				read:AuthUserIsAdmin
			}
		},
		//texts sent to contact
		sentTexts:{
			type:Virtual,
			extendGraphQLTypes:['type SentToContactTexts {id: ID, content: String, status: String,date: String}'],
			graphQLReturnType:'[SentToContactTexts]',
			graphQLReturnFragment:`{
				id,
				content,
				status,
				date
			}`,
			resolver:async (item)=>{
				return await getItems({keystone,listKey:'SentText',returnFields:'id, content, status, date',where:{to:item.phone}});
			}
		},
		receivedTexts:{
			type:Virtual,
			extendGraphQLTypes:['type ReceivedFromContactTexts {id: ID, content: String ,date: String}'],
			graphQLReturnType:'[ReceivedFromContactTexts]',
			graphQLReturnFragment:`{
				id,
				content,
				date
			}`,
			resolver:async (item)=>{
				return await getItems({keystone,listKey:'ReceivedText',returnFields:'id, content, date',where:{from:item.phone}});
			}
		},
		language:{
			type:Select,
			options:[
				{value:'en',label:'English'},
				{value:'es',label:'Spanish'}
			],
			dataType:'enum',
			defaultValue:'en'

		},
		answers:{
			type:Relationship,
			ref:'ScriptAnswer.contact',
			many:true,
			access:{
				update:AuthUserIsAdmin
			}
		},
		users:{
			type:Relationship,
			ref:'User.contacts',
			many:true,
			access:{
				update:AuthUserIsAdmin,
				read:AuthUserIsAdmin
			}
		}
	}
});
keystone.createList('DoNotContactPhone',{
	access:{
		create:AuthUserIsAdmin,
		read:AuthUserIsAdmin,
		update:AuthUserIsAdmin,
		delete:AuthUserIsAdmin
	},
	fields:{
		phone:{
			type:Text,
			isRequired:true,
			isUnique:true
		}
	}
});


keystone.createList('EmailInvite',{
	access:{
		create:()=>{return false},
		read:AuthUserIsAdmin,
		update:()=>{return false},
		delete:AuthUserIsAdmin,
	},
	fields:{
		tokenHash:{
			type:Text,
			isRequired:true,
			access:{
				read:()=>{return false}
			}
		},
		email:{
			type:Text,
			isRequired:true,
		},
		dateCreated:{
			type:DateTimeUtc,
			isRequired:true,
		}
	}
});

keystone.createList('User',{
	access:{
		create:AuthUserIsAdmin,
		read:AuthUserIsAuthedForUserList,
		update:AuthUserIsAuthedForUserList,
		delete:AuthUserIsAdmin,
		auth:true
	},
	fields:{
		email:{
			type:Text,
			isRequired:true,
			isUnique:true,
			access:{
				read:AuthUserIsAdmin,
				update:AuthUserIsAdmin
			},
		},
		password:{
			type:Password,
			access:{
				read:AuthUserIsAdmin,
				update:AuthUserIsAdmin
			}

		},
		role:{
			type:Select,
			options:[
				{value:'none',label:'None'},
				{value:'volunteer',label:'Volunteer'},
				{value:'admin',label:'Administrator'}
			],
			dataType:'enum',
			defaultValue:'none',
			access:{
				read:AuthUserIsAdmin,
				update:AuthUserIsAdmin
			}
		},
		scripts:{
			type:Relationship,
			ref:'Script.users',
			many:true,
			access:{
				update:AuthUserIsAdmin
			}
		},
		nickName:{
			type:Text,
		},
		contacts:{
			type:Relationship,
			ref:'Contact.users',
			many:true,
			access:{
				update:AuthUserIsAdmin
			}
		}
	}

});

const authStrategy=keystone.createAuthStrategy({
	type:PasswordAuthStrategy,
	list:'User',
	config:{
		identityField:'email',
		secretField:'password',
		protectIdentities:true
	}
});


const sendText=async (par,args,context,info,extra)=>{
	console.log('To '+args.contact);
	console.log('Message '+args.content);
	let twilError=null;
	// let twilID;
	let twilMessage;

	let contact;
	try{
		contact=await getItem({keystone,listKey:'Contact',itemId:args.contact, returnFields:'phone'});
		console.log(contact);
		if(!/^\+1\d{10}$/.test(contact.phone)){
			console.log('non valid phone');
			throw 'bad phone';
		}
	}
	catch(e){
		console.log(e);
		return {
			content:args.content,
			failedToSend:true
		}
	}
	
	

	try{
		let message=await twilioClient.messages.create({
			body:args.content,
			from:process.env.TWILNUMBER,
			to:contact.phone
		});
		console.log(message);
		twilMessage=message
		// twilID=message.sid;
	}
	catch(err){
		console.log(err);
		twilError=err;
	}
	if(twilError===null){
		//replace with https://www.keystonejs.com/keystonejs/server-side-graphql-client/ ?
		context.executeGraphQL({
			query:` mutation  ($phone: String!, $msgTxt: String!,$id: String!,$twilStatus: String!,$twilDate: String!){
				createSentText(data:{content:$msgTxt,to:$phone,twilID:$id,status:$twilStatus,date:$twilDate}){
					content,
					status,
					twilID
				}
			}
			`,
			variables:{
				phone:contact.phone,
				msgTxt:args.content,
				id:twilMessage.sid,
				twilStatus:twilMessage.status,
				twilDate:(new Date(twilMessage.dateCreated)).toISOString()
			},
			context:serverContext(keystone)
		})
	}
	return {
		content:args.content,
		failedToSend:twilError!==null
	}

}
keystone.extendGraphQLSchema({


	types:[
		{
			type:'type SendTextOutput { content: String!, failedToSend: Boolean!} '
		},
		{
			type:'type toggleDoNotContactOutput { success: Boolean!} '
		},
		{
			type: 'type sendEmailInviteOutput { success: Boolean!}'
		},
		{
			type:'type createVolunteerFromTokenOutput { success: Boolean!}'
		}
	],
	mutations: [
		{
			schema: 'sendText(content:String!, contact:ID!):SendTextOutput',
			resolver:sendText,
			access:AuthUserHasArgContactForCustomSchema
		},
		{
			schema:'toggleDoNotContact(contact:ID!):toggleDoNotContactOutput',
			resolver:async (par,args,context,info,extra)=>{
				try{
					let theContact=await getItem({keystone,listKey:'Contact',itemId:args.contact,returnFields:'phone'});

					let blockArr=await getItems({keystone,listKey:'DoNotContactPhone',where:{phone:theContact.phone},returnFields:'id phone'});
					if(blockArr.length>0){
						await deleteItem({keystone,listKey:'DoNotContactPhone',itemId:blockArr[0].id});
					}
					else{
						await createItem({keystone,listKey:'DoNotContactPhone',item:{
							phone:theContact.phone
						}});
					}
					return {
						success:true
					};

				}
				catch(err){
					return {
						success:false
					};
				}
				return {
					success:false
				};
			},
			access:AuthUserHasArgContactForCustomSchema
		},
		{
			schema:'sendInviteEmail(email:String!):sendEmailInviteOutput',
			resolver:async (par,args,context,info,extra)=>{
				try{

					let token=crypto.randomBytes(20).toString('base64');
					let tokenHash=await bycrypt.hash(token,10);
					let inviteItem=await createItem({keystone,listKey:'EmailInvite',item:{
						email:args.email,
						tokenHash:tokenHash,
						dateCreated:(new Date()).toISOString()

					}});
					console.log('creted in db');

					console.log(token);
					console.log(tokenHash);
					let t=await mail.createTransport();
					let email=await mail.email(t,args.email,'Textbank Invite',`

					your login email will be ${args.email}
					token ${token}
					
					`);
					console.log('email sent')
					if(process.env.STMPSERVERHOST==='smtp.ethereal.email'){
						console.log('showing test')
						console.log('Email preview: '+nodemailer.getTestMessageUrl(email));
						console.log('done test send')
					}
					console.log('done')
					return {
						success:true
					};
				}
				catch(err){
					console.log(err);
					return {
						success:false
					};
				}
				return {
					success:false
				};
			},
			access:AuthUserIsAdmin
		},
		{
			schema:'createVolunteerFromToken(token:String!,password:String!):createVolunteerFromTokenOutput',
			resolver:async (par,args,context,info,extra)=>{
				try{
					let invites=await getItems({keystone,listKey:'EmailInvite',returnFields:'id tokenHash email dateCreated'});
					let validInvites= invites.filter((el)=>{
						let dc=(new Date(el.dateCreated)).getTime();
						let bcRes=bycrypt.compareSync(args.token,el.tokenHash);
						console.log('testing invites');
						console.log(dc);
						console.log(bcRes);
						return (dc>(Date.now()-1000*60*60*24))&&bcRes
					});

					if(validInvites.length>0){
						theInvite=validInvites[0];
						await deleteItem({keystone,listKey:'EmailInvite',itemId:theInvite.id});
						await createItem({keystone,listKey:'User',returnFields:'id',item:{
							email:theInvite.email,
							password:args.password,
							role:'volunteer'
						}});
						return {
							success:true
						};
					}
					else{
						console.log('token issue');
						
						return {
							success:false
						}
					}

				}
				catch(err){
					console.log(err);
					return {
						success:false
					}
				}
				return {
					success:false
				}
			}
		}
	]
});




//

module.exports={
	keystone,
	apps:[
		new GraphQLApp(),
		new NextApp({dir:'chat'})
	]
}