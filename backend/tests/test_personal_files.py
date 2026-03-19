"""
Test Personal Files API - Private file storage for admin
Tests: Authentication, Folder CRUD, File upload/delete, Search, Admin-only access
"""
import pytest
import requests
import os
import base64
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@avarus.ru"
ADMIN_PASSWORD = "admin"
PERSONAL_FILES_PASSWORD = "GenSutSu1999"

# Create a simple 1x1 red PNG for upload testing
def create_test_image():
    """Create a minimal valid PNG image (1x1 red pixel)"""
    # Minimal valid PNG - 1x1 red pixel
    png_data = base64.b64decode(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    )
    return png_data


@pytest.fixture(scope="module")
def admin_session():
    """Get authenticated admin session with JWT token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login as admin
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code}")
    
    # Extract token and add to headers
    data = response.json()
    token = data.get("token")
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    
    return session


@pytest.fixture(scope="module")
def regular_user_session():
    """Get a regular (non-admin) user session for testing access control"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Try to login as regular user or create one
    test_email = "TEST_pf_regular@example.com"
    test_password = "testpass123"
    
    # Try login first
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    
    if response.status_code == 200:
        token = response.json().get("token")
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    
    # Register new user
    register_response = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": test_email,
        "password": test_password,
        "name": "Test Regular User"
    })
    
    if register_response.status_code in [200, 201]:
        # Login after registration
        login_response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": test_password
        })
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            if token:
                session.headers.update({"Authorization": f"Bearer {token}"})
            return session
    
    pytest.skip("Could not create regular user session")


class TestPersonalFilesAuth:
    """Personal Files Password Authentication Tests"""
    
    def test_auth_correct_password(self, admin_session):
        """POST /api/personal-files/auth - correct password returns success"""
        response = admin_session.post(f"{BASE_URL}/api/personal-files/auth", json={
            "password": PERSONAL_FILES_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
    
    def test_auth_wrong_password(self, admin_session):
        """POST /api/personal-files/auth - wrong password returns 401"""
        response = admin_session.post(f"{BASE_URL}/api/personal-files/auth", json={
            "password": "wrongpassword123"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        data = response.json()
        assert "detail" in data or "error" in data
    
    def test_auth_empty_password(self, admin_session):
        """POST /api/personal-files/auth - empty password returns 401"""
        response = admin_session.post(f"{BASE_URL}/api/personal-files/auth", json={
            "password": ""
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_auth_non_admin_forbidden(self, regular_user_session):
        """POST /api/personal-files/auth - non-admin user gets 403"""
        response = regular_user_session.post(f"{BASE_URL}/api/personal-files/auth", json={
            "password": PERSONAL_FILES_PASSWORD
        })
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestFolderCRUD:
    """Folder CRUD operations tests"""
    
    def test_get_folders(self, admin_session):
        """GET /api/personal-files/folders - returns list of folders"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/folders")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "folders" in data
        assert isinstance(data["folders"], list)
    
    def test_create_folder(self, admin_session):
        """POST /api/personal-files/folders - creates new folder"""
        folder_name = "TEST_Folder_" + str(os.urandom(4).hex())
        response = admin_session.post(f"{BASE_URL}/api/personal-files/folders", json={
            "name": folder_name
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "id" in data
        assert data.get("name") == folder_name
        
        # Store folder ID for later tests
        TestFolderCRUD.created_folder_id = data["id"]
        TestFolderCRUD.created_folder_name = folder_name
    
    def test_folder_has_file_count(self, admin_session):
        """GET /api/personal-files/folders - folders include file_count"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/folders")
        assert response.status_code == 200
        data = response.json()
        folders = data.get("folders", [])
        if folders:
            # Check that at least one folder has file_count field
            for folder in folders:
                assert "file_count" in folder, "Folder should have file_count field"
    
    def test_rename_folder(self, admin_session):
        """PUT /api/personal-files/folders/{folder_id} - renames folder"""
        if not hasattr(TestFolderCRUD, 'created_folder_id'):
            pytest.skip("No folder created to rename")
        
        new_name = "TEST_Renamed_" + str(os.urandom(4).hex())
        response = admin_session.put(
            f"{BASE_URL}/api/personal-files/folders/{TestFolderCRUD.created_folder_id}",
            json={"name": new_name}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify rename worked
        folders_response = admin_session.get(f"{BASE_URL}/api/personal-files/folders")
        folders = folders_response.json().get("folders", [])
        found = any(f["id"] == TestFolderCRUD.created_folder_id and f["name"] == new_name for f in folders)
        assert found, "Folder was not renamed correctly"
    
    def test_rename_nonexistent_folder(self, admin_session):
        """PUT /api/personal-files/folders/{folder_id} - 404 for nonexistent folder"""
        response = admin_session.put(
            f"{BASE_URL}/api/personal-files/folders/nonexistent-id-12345",
            json={"name": "Test Name"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_folders_non_admin_forbidden(self, regular_user_session):
        """GET /api/personal-files/folders - non-admin user gets 403"""
        response = regular_user_session.get(f"{BASE_URL}/api/personal-files/folders")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestFileOperations:
    """File upload, list, and delete tests"""
    
    def test_upload_file(self, admin_session):
        """POST /api/personal-files/upload - uploads file to Cloudinary"""
        test_image = create_test_image()
        files = {'file': ('TEST_image.png', io.BytesIO(test_image), 'image/png')}
        data = {'folder_id': ''}
        
        # Get authorization token from session
        auth_header = admin_session.headers.get('Authorization', '')
        headers = {'Authorization': auth_header} if auth_header else {}
        
        response = requests.post(
            f"{BASE_URL}/api/personal-files/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        file_data = response.json()
        
        # Verify response structure
        assert "id" in file_data
        assert "url" in file_data
        assert "name" in file_data
        assert file_data["file_type"] == "image"
        
        # Store for later tests
        TestFileOperations.uploaded_file_id = file_data["id"]
        TestFileOperations.uploaded_file_url = file_data["url"]
    
    def test_upload_file_to_folder(self, admin_session):
        """POST /api/personal-files/upload - uploads file to specific folder"""
        # First create a folder
        folder_name = "TEST_UploadFolder_" + str(os.urandom(4).hex())
        folder_response = admin_session.post(f"{BASE_URL}/api/personal-files/folders", json={
            "name": folder_name
        })
        if folder_response.status_code != 200:
            pytest.skip("Could not create folder for upload test")
        
        folder_id = folder_response.json()["id"]
        
        test_image = create_test_image()
        files = {'file': ('TEST_folder_image.png', io.BytesIO(test_image), 'image/png')}
        data = {'folder_id': folder_id}
        
        # Get authorization token from session
        auth_header = admin_session.headers.get('Authorization', '')
        headers = {'Authorization': auth_header} if auth_header else {}
        
        response = requests.post(
            f"{BASE_URL}/api/personal-files/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        file_data = response.json()
        assert file_data.get("folder_id") == folder_id
        
        # Store for cleanup
        TestFileOperations.folder_with_file_id = folder_id
        TestFileOperations.folder_file_id = file_data["id"]
    
    def test_get_files(self, admin_session):
        """GET /api/personal-files/files - returns list of files"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "files" in data
        assert isinstance(data["files"], list)
    
    def test_get_files_by_folder(self, admin_session):
        """GET /api/personal-files/files?folder_id=X - filters by folder"""
        if not hasattr(TestFileOperations, 'folder_with_file_id'):
            pytest.skip("No folder with file available")
        
        response = admin_session.get(
            f"{BASE_URL}/api/personal-files/files",
            params={"folder_id": TestFileOperations.folder_with_file_id}
        )
        assert response.status_code == 200
        data = response.json()
        files = data.get("files", [])
        # All returned files should be in the specified folder
        for f in files:
            assert f.get("folder_id") == TestFileOperations.folder_with_file_id
    
    def test_search_files(self, admin_session):
        """GET /api/personal-files/files?search=X - filters by filename"""
        response = admin_session.get(
            f"{BASE_URL}/api/personal-files/files",
            params={"search": "TEST_"}
        )
        assert response.status_code == 200
        data = response.json()
        files = data.get("files", [])
        # All returned files should match the search term
        for f in files:
            assert "TEST_" in f.get("name", "").upper() or "test_" in f.get("name", "").lower()
    
    def test_delete_file(self, admin_session):
        """DELETE /api/personal-files/files/{file_id} - deletes file"""
        if not hasattr(TestFileOperations, 'uploaded_file_id'):
            pytest.skip("No uploaded file to delete")
        
        response = admin_session.delete(
            f"{BASE_URL}/api/personal-files/files/{TestFileOperations.uploaded_file_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("success") == True
        
        # Verify file is gone
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        files = files_response.json().get("files", [])
        found = any(f["id"] == TestFileOperations.uploaded_file_id for f in files)
        assert not found, "File should have been deleted"
    
    def test_delete_nonexistent_file(self, admin_session):
        """DELETE /api/personal-files/files/{file_id} - 404 for nonexistent file"""
        response = admin_session.delete(
            f"{BASE_URL}/api/personal-files/files/nonexistent-file-id-12345"
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_files_non_admin_forbidden(self, regular_user_session):
        """GET /api/personal-files/files - non-admin user gets 403"""
        response = regular_user_session.get(f"{BASE_URL}/api/personal-files/files")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
    
    def test_upload_non_admin_forbidden(self, regular_user_session):
        """POST /api/personal-files/upload - non-admin user gets 403"""
        test_image = create_test_image()
        files = {'file': ('test.png', io.BytesIO(test_image), 'image/png')}
        
        # Get authorization token from session
        auth_header = regular_user_session.headers.get('Authorization', '')
        headers = {'Authorization': auth_header} if auth_header else {}
        
        response = requests.post(
            f"{BASE_URL}/api/personal-files/upload",
            files=files,
            data={'folder_id': ''},
            headers=headers
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"


class TestFileTypes:
    """Test file type detection"""
    
    def test_file_type_detection_image(self, admin_session):
        """File type detection for images (jpg, png, etc.)"""
        test_image = create_test_image()
        
        # Get authorization token from session
        auth_header = admin_session.headers.get('Authorization', '')
        headers = {'Authorization': auth_header} if auth_header else {}
        
        for ext, expected_type in [('png', 'image'), ('jpg', 'image'), ('jpeg', 'image')]:
            files = {'file': (f'TEST_file.{ext}', io.BytesIO(test_image), f'image/{ext}')}
            response = requests.post(
                f"{BASE_URL}/api/personal-files/upload",
                files=files,
                data={'folder_id': ''},
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                assert data.get("file_type") == expected_type, f"Expected {expected_type} for .{ext}"
                # Cleanup
                admin_session.delete(f"{BASE_URL}/api/personal-files/files/{data['id']}")


class TestDeleteFolder:
    """Test folder deletion (runs last to clean up)"""
    
    def test_delete_folder_with_files(self, admin_session):
        """DELETE /api/personal-files/folders/{folder_id} - deletes folder and all files"""
        if not hasattr(TestFileOperations, 'folder_with_file_id'):
            pytest.skip("No folder to delete")
        
        response = admin_session.delete(
            f"{BASE_URL}/api/personal-files/folders/{TestFileOperations.folder_with_file_id}"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify folder is gone
        folders_response = admin_session.get(f"{BASE_URL}/api/personal-files/folders")
        folders = folders_response.json().get("folders", [])
        found = any(f["id"] == TestFileOperations.folder_with_file_id for f in folders)
        assert not found, "Folder should have been deleted"
    
    def test_delete_created_test_folder(self, admin_session):
        """Cleanup: Delete test folder created in folder tests"""
        if hasattr(TestFolderCRUD, 'created_folder_id'):
            response = admin_session.delete(
                f"{BASE_URL}/api/personal-files/folders/{TestFolderCRUD.created_folder_id}"
            )
            # Might already be deleted, so accept 200 or 404
            assert response.status_code in [200, 404]


class TestUnauthenticated:
    """Test that unauthenticated requests are rejected"""
    
    def test_auth_unauthenticated(self):
        """POST /api/personal-files/auth - requires authentication"""
        response = requests.post(f"{BASE_URL}/api/personal-files/auth", json={
            "password": PERSONAL_FILES_PASSWORD
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_folders_unauthenticated(self):
        """GET /api/personal-files/folders - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/personal-files/folders")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_files_unauthenticated(self):
        """GET /api/personal-files/files - requires authentication"""
        response = requests.get(f"{BASE_URL}/api/personal-files/files")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
