export function vanUrlID(vanid){
	return vanid.toString(16).split('').reverse().join('').toUpperCase()+ (vanid%17+10).toString(36).toUpperCase();
}