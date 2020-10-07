'use strict';
const twilioClient=require('twilio')(process.env.TWILSID,process.env.TWILAUTHTOKEN);
const { createItem ,getItems,updateItem,getItem,deleteItem} = require('@keystonejs/server-side-graphql-client');


async function getTexts (keystone,{dateAfter,dateBefore}){
	console.log('Texts');
	let twilioRecivedQuery={to:process.env.TWILNUMBER}
	if(dateAfter!==undefined){
		twilioRecivedQuery.dateSentAfter=dateAfter
	}
	if(dateBefore!==undefined){
		twilioRecivedQuery.dateSentBefore=dateBefore
	}

	let receivedMessages=await twilioClient.messages.list(twilioRecivedQuery);
	console.log(receivedMessages.length);
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

	let twilioSentQuery={from:process.env.TWILNUMBER}
	if(dateAfter!==undefined){
		twilioSentQuery.dateSentAfter=dateAfter
	}
	if(dateBefore!==undefined){
		twilioSentQuery.dateSentBefore=dateBefore
	}
	let sentMessages=await twilioClient.messages.list(twilioSentQuery);
	console.log(sentMessages.length);
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
}

module.exports={
	getTexts
}