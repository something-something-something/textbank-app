import {useState,useEffect} from 'react'
import {queryGraphQL} from '../lib/graphql'
import styles from '../components/NavMenu.module.css'

export default function NavMenu(props){
	const [user,setUser]=useState(null);
	const fetchData=async()=>{
		let res=await queryGraphQL(`
			query {
				authenticatedUser{
					id
					email
					role
				}

			}
		`,{});
		setUser(res.data.authenticatedUser)
	};
	useEffect(()=>{
		fetchData();
	},[])

	return (<div className={styles.menu}>
		{user===null?(<>
			<a href="/login">Log In</a> 
		</>):(<>
			


			 <a href="/">Scripts</a>

			 <a href="/login">Log Out</a> 
			 <a href="/profile">Profile</a> 
			{user.role==='admin'&&(
				<>
					 <a href="/edit/scripts">Edit Scripts</a> 
					 <a href="/edit/users">Administer Users</a> 
				</>
			)

			}
		</>)}
	</div>);
}