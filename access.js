
function AuthUserIsAdmin({authentication}){
	if(authentication.item!==undefined&&authentication.item.role==='admin'){
		return true;
	}
	return false;
}



function AuthUserIsVolunteer({authentication}){
	if(authentication.item!==undefined&& authentication.item.role=='volunteer'){
		return true;
	}
	return false;
}

function AuthUserIsAdminOrVolunteer({authentication}){
	return AuthUserIsAdmin({authentication})||AuthUserIsVolunteer({authentication});
}




async function AuthUserIsScriptUser({authentication,existingItem,context}){

	let con=context.createContext({skipAccessControl:true});
	if(AuthUserIsAdmin({authentication})){
		return true;
	}
	if(AuthUserIsVolunteer({authentication})){
		try{
			let res=await context.executeGraphQL({
				context:con,
				query:`
					query($uID: ID!){
						User(where:{id:$uID}){
							scripts{
								id
							}
						}
					}
				`,
				variables:{
					uID:authentication.item.id
				}
			});
			console.log('QUERY!!!');

			console.log(res)
			let user=res.data.User;

			return user.scripts.some((el)=>{
				return el.id===existingItem.id;
			});
		}
		catch(e){
			console.log(e)
			return false;
		}
	}
	return false;
}

function AuthUserIsAuthedForContacList({authentication}){
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
}


async function AuthUserIsAuthedForScriptAnswerList({authentication,context}){
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
}

async function AuthUserHasArgContactForCustomSchema({authentication,context,args}){
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

module.exports={
	AuthUserIsAdmin,
	AuthUserIsVolunteer,
	AuthUserIsAdminOrVolunteer,
	AuthUserIsScriptUser,
	AuthUserIsAuthedForScriptAnswerList,
	AuthUserIsAuthedForContacList,
	AuthUserHasArgContactForCustomSchema,
}