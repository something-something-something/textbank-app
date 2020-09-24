const {Keystone}=require('@keystonejs/keystone');
const {MongooseAdapter}=require('@keystonejs/adapter-mongoose');
const {GraphQLApp}=require('@keystonejs/app-graphql');
const {Text,DateTimeUtc, Relationship, Integer,Virtual, Select, Password} =require('@keystonejs/fields');
const { createItem ,getItems,updateItem,getItem} = require('@keystonejs/server-side-graphql-client');
const {NextApp} =require('@keystonejs/app-next');
const {PasswordAuthStrategy}=require('@keystonejs/auth-password')
const twilioClient=require('twilio')(process.env.TWILSID,process.env.TWILAUTHTOKEN);
const {AuthUserIsAdmin,AuthUserIsVolunteer,AuthUserIsAdminOrVolunteer,AuthUserIsScriptUser}=require('./access');

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
			access:{
				read:AuthUserIsScriptUser
			}
		},
		scriptLines:{
			type:Relationship,
			ref:'ScriptLine.script',
			many:true,
			access:{
				read:AuthUserIsScriptUser
			}
		},
		contacts:{
			type:Relationship,
			ref:'Contact.script',
			many:true,
			access:{
				read:AuthUserIsScriptUser
			}
		},
		questions:{
			type:Relationship,
			ref:'ScriptQuestion.script',
			many:true,
			access:{
				read:AuthUserIsScriptUser
			}
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
									contacts{
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
						OR: user.contacts.map((el) => {
							return {
								contact: {
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
		contact:{
			type:Relationship,
			ref:'Contact.answers',
		},
		question:{
			type:Relationship,
			ref:'ScriptQuestion.answers',
			isRequired:true
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
		read:({authentication})=>{
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if (AuthUserIsVolunteer({ authentication })) {
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
		script:{
			type:Relationship,
			ref:'Script.contacts',
			isRequired:true
		},
		firstName:{
			type:Text,
			defaultValue:''
		},
		middleName:{
			type:Text,
			defaultValue:''
		},
		lastName:{
			type:Text,
			defaultValue:''
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
		vanid:{
			type:Text,
			defaultValue:''
		},

		phone:{
			type:Text
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
			many:true
		},
		users:{
			type:Relationship,
			ref:'User.contacts',
			many:true
		}
	}
});

keystone.createList('User',{
	access:{
		create:AuthUserIsAdmin,
		read:({authentication})=>{
			if(AuthUserIsAdmin({authentication})){
				return true;
			}
			else if (AuthUserIsVolunteer({ authentication })) {
				return {
					id:authentication.item.id
				}
			}
			return false;
		},
		update:AuthUserIsAdmin,
		delete:AuthUserIsAdmin,
		auth:true
	},
	fields:{
		email:{
			type:Text,
			isRequired:true,
			isUnique:true
		},
		password:{
			type:Password,
			access:{
				read:()=>{return false}
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
			defaultValue:'none'
		},
		scripts:{
			type:Relationship,
			ref:'Script.users',
			many:true
		},
		contacts:{
			type:Relationship,
			ref:'Contact.users',
			many:true
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
		}
	],
	mutations: [
		{
			schema: 'sentText(content:String!, contact:ID!):SendTextOutput',
			resolver:sendText,
			access:async({authentication,context,args})=>{
				if(AuthUserIsAdmin({authentication})){
					return true;
				}
				else if(AuthUserIsVolunteer({authentication})){
					try{
						let res=await context.executeGraphQL({
							context:context.createContext({skipAccessControl:true}),
							query:`
								query($uID: ID!){
									User(where:{id:$uID}){
										contacts{
											id
										}
									}
								}
							`,
							variables:{
								uID:authentication.item.id
							}
						});
						let user=res.data.User;
			
						return user.contacts.some((el)=>{
							return el.id===args.contact;
						});
					}
					catch(e){
						return false;
					}
				}
				return false;
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