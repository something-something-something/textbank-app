


function AuthUserIsAdmin({authentication}){
	if(authentication.item!==undefined&&authentication.item.role==='admin'){
		return true;
	}
	return false;
}


module.exports={
	AuthUserIsAdmin
}