'use strict';
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
const expressSession=require('express-session');
const MongoDBStore=require('connect-mongodb-session')(expressSession)
const mail=require('./mail');
const {getTexts}=require('./text');
const helmet = require('helmet');



function serverContext(keystone){ 
	return keystone.createContext({skipAccessControl:true});
};


const keystone=new Keystone({
	adapter: new MongooseAdapter({mongoUri:process.env.URLMONGO}),
	cookie:{
		secure:process.env.NODE_ENV === 'production',
		maxAge: 1000 * 60 * 60 * 24 * 30,
		sameSite:'strict'
	},
	cookieSecret:process.env.COOKIESECRET,
	sessionStore:new MongoDBStore({
		uri:process.env.MONGOSESSIONURI,
		collection:process.env.MONGOSESSIONCOLLECTION
	}),
	onConnect:()=>{
		console.log('connected');

		const addUserIfNone=async()=>{
			try{
				let users=await getItems({keystone,listKey:'User',returnFields:'id'});
				if(users.length===0){
					console.log('adding user');
					// await createItem({
					// 	keystone,
					// 	listKey:'User',
					// 	item:{
					// 		email:'admin',
					// 		password:'password',
					// 		role:'admin'
					// 	}
					// })

					let res=keystone.executeGraphQL({
						query:`
							mutation($email:String!,$role:String!){
								sendInviteEmail(email:$email,role:$role){
									success
								}
							}
						`,
						variables:{
							email:process.env.ADMININVITEEMAIL,
							role:'admin'
						},
						context:keystone.createContext({skipAccessControl:true})
					});
					if(res.data.sendInviteEmail.success){
						console.log('email sent')
					}
					else{
						console.log('email failed')
					}
				}
			}
			catch(err){
				console.log('error sending invite email');
			}
		};

		addUserIfNone();
		getTexts(keystone,{});
		setInterval(async ()=>{
			let currTime=(new Date()).getTime(); 
			getTexts(keystone, {
				dateAfter:new Date(currTime - ( 1000*60*2))
			});


		},15*1000);

		setInterval(async ()=>{
			console.log('sync old');
			
			let currTime=(new Date()).getTime(); 
			getTexts(keystone, {
				dateBefore:new Date(currTime - (1000*60*30))
			});


		},1000*60*30);
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
		},
		scriptLines:{
			type:Relationship,
			ref:'ScriptLine.questions',
			many:true,
		},
		suggestedOptions:{
			type:Text,
			defaultValue:''

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
		questions:{
			type:Relationship,
			ref:'ScriptQuestion.scriptLines',
			many:true
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
					//console.log(both);
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
		}
	}
});

keystone.createList('PasswordResetRequest',{
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
		user:{
			type:Relationship,
			ref:'User'
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
			defaultValue:'Your Nick Name',
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
		},
		{
			type:'type requestEmailPasswordResetOutput { success: Boolean!}'
		},
		{
			type:'type resetPasswordOutput { success: Boolean!}'
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
			schema:'sendInviteEmail(email:String!,role:String!):sendEmailInviteOutput',
			resolver:async (par,args,context,info,extra)=>{
				try{

					let token=crypto.randomBytes(20).toString('base64');
					let tokenHash=await bycrypt.hash(token,10);
					let inviteItem=await createItem({keystone,listKey:'EmailInvite',item:{
						email:args.email,
						tokenHash:tokenHash,
						dateCreated:(new Date()).toISOString(),
						role:args.role

					}});
					console.log('creted in db');

					//console.log(token);
					//console.log(tokenHash);
					let t=await mail.createTransport();
					let email=await mail.email(t,args.email,'Textbank Invite',`

					your login email will be ${args.email}
					Email is case sensitive.
					Join here:
					${process.env.TEXTBANKURL}invite?token=${token}
					
					`,
					`
					Your login email will be ${args.email}<br>
					Email is case sensitive.<br>
					<a href="${process.env.TEXTBANKURL}invite?token=${encodeURIComponent( token)}">Join Here</a>
					or copy and paste this address in the address bar: ${process.env.TEXTBANKURL}invite?token=${encodeURIComponent(token)}


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
					let invites=await getItems({keystone,listKey:'EmailInvite',returnFields:'id tokenHash email dateCreated role'});
					let validInvites= invites.filter((el)=>{
						let dc=(new Date(el.dateCreated)).getTime();
						let bcRes=bycrypt.compareSync(args.token,el.tokenHash);
						console.log('testing invites');
						console.log(dc);
						console.log(bcRes);
						return (dc>(Date.now()-1000*60*60*24))&&bcRes
					});

					if(validInvites.length>0){
						let theInvite=validInvites[0];
						await deleteItem({keystone,listKey:'EmailInvite',itemId:theInvite.id});
						await createItem({keystone,listKey:'User',returnFields:'id',item:{
							email:theInvite.email,
							password:args.password,
							role:theInvite.role
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
		},
		{
			schema:'requestEmailPasswordReset(email:String!):requestEmailPasswordResetOutput',
			resolver:async(par,args,context,info,extra)=>{
				try{
					let token=crypto.randomBytes(20).toString('base64');
					let tokenHash=await bycrypt.hash(token,10);

					let users=await getItems({keystone,listKey:'User',returnFields:'id email'});
					let theUser=users.find((u)=>{return u.email===args.email});
					if(theUser===undefined){
						return {
							success:true
						};
					}

					await createItem({keystone,listKey:'PasswordResetRequest',
						item:{
							user:{
								connect:{
									id:theUser.id
								}
							},
							tokenHash:tokenHash,
							dateCreated:(new Date()).toISOString(),
						}
					});
					let t=await mail.createTransport();
					let email=await mail.email(t,theUser.email,'Textbank Password Reset',`

					A password reset was requested for:${theUser.email} If you did not request this please ignore.
					Email is case sensitive.
					reset here: 
					${process.env.TEXTBANKURL}resetpassword?token=${token}
					
					`,
					`
					A password reset was requested for:${theUser.email} If you did not request this please ignore.
					Email is case sensitive.
					reset here: 
					<a href="${process.env.TEXTBANKURL}resetpassword?token=${encodeURIComponent( token)}">Reset Password</a>
					or copy and paste this address in the address bar: ${process.env.TEXTBANKURL}resetpassword?token=${encodeURIComponent(token)}


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
					return {
						success:true
					};
				}
			}	
		},
		{
			schema:'resetPassword(token:String!,password:String!):resetPasswordOutput',
			resolver:async (par,args,context,info,extra)=>{
				try{
					console.log('reseting password')
					let resetReqs=getItems({keystone,listKey:'PasswordResetRequest',returnFields:'id tokenHash user{ id } dateCreated '});
					console.log((await resetReqs).length);
					let validResetReqs=(await resetReqs).filter((el)=>{
						let dc=(new Date(el.dateCreated)).getTime();
						let bcRes=bycrypt.compareSync(args.token,el.tokenHash);
						console.log('testing invites');
						console.log(dc);
						console.log(bcRes);
						return (dc>(Date.now()-1000*60*30))&&bcRes
					});
					if(validResetReqs.length>0){
						let theResetReq=validResetReqs[0];
						//console.log(theResetReq);
						await deleteItem({keystone,listKey:'PasswordResetRequest',itemId:theResetReq.id});
						await updateItem({
							keystone,listKey:'User',item:{
								id:theResetReq.user.id,
								data:{
									password:args.password
								}
							},
							returnFields:'id'
						});
						return  {
							success:true
						};
					}
					else{
						return  {
							success:false
						};
					}
				}
				catch(err){
					console.log(err);
					return {
						success:false
					};
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
	],
	configureExpress:(app)=>{
			// app.use(helmet.contentSecurityPolicy({
			// 	directives:{
			// 		//defaultSrc:["'none'"],
			// 		defaultSrc:[],
			// 		frameAncestors:["'self'"]
			// 	}
			// }));
		app.use(helmet.noSniff());
		app.use(helmet.frameguard())
		if(process.env.NODE_ENV==='production'){
			app.use(helmet.hsts({
				maxAge:60
			}));
			app.use((req,res,next)=>{
				if(req.secure){
					next();
				}
				else{
					res.redirect('https://'+req.hostname+req.originalUrl);
					res.send('Redirecting');
				}
			});
			
		}
		app.use((req,res,next)=>{
			res.set('Content-Security-Policy',"frame-ancestors 'none';");
			next();
		});		
		app.set('trust proxy',1);

		
	}
}