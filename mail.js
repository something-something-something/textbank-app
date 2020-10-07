const nodemailer=require('nodemailer');


async function createTransport(){

	let user=process.env.STMPSERVERUSER;
	let pass=process.env.STMPSERVERPASS;


	if(process.env.STMPSERVERHOST==='smtp.ethereal.email'){
		let testAcc=await nodemailer.createTestAccount();
		user=testAcc.user;
		pass=testAcc.pass;
	}



	let transport=nodemailer.createTransport({
		host:process.env.STMPSERVERHOST,
		port:process.env.STMPSERVERPOST,
		secure:process.env.STMPSERVERSECURE==='TRUE'?true:false,
		auth:{
			user:user,
			pass:pass
		}
	});
	console.log('transport')
	return transport;
}




async function email(transport,address,subject,text,html){
	
	return await transport.sendMail({
		from:process.env.EMAILADDRESS,
		to:{
			name:address,
			address:address
		},
		subject:subject,
		text:text,
		html:html
	});



}

module.exports={
	createTransport,
	email
}