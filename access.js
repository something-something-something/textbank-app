
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


module.exports={
	AuthUserIsAdmin,
	AuthUserIsVolunteer,
	AuthUserIsAdminOrVolunteer,
	AuthUserIsScriptUser,
	
}