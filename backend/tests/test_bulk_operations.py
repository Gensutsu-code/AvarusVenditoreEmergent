"""
Test Bulk Operations API - Drag & Drop and Selection Mode Features
Tests: Bulk Move, Bulk Add Tags, Bulk Delete
Iteration 54: New features for file management
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
PERSONAL_FILES_PASSWORD = "GenSutSu.1999"

# Create a simple 1x1 red PNG for upload testing
def create_test_image():
    """Create a minimal valid PNG image (1x1 red pixel)"""
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
    
    data = response.json()
    token = data.get("token")
    if token:
        session.headers.update({"Authorization": f"Bearer {token}"})
    
    return session


@pytest.fixture(scope="module")
def test_files(admin_session):
    """Create test files for bulk operations"""
    created_files = []
    auth_header = admin_session.headers.get('Authorization', '')
    headers = {'Authorization': auth_header} if auth_header else {}
    
    # Create 3 test files
    for i in range(3):
        test_image = create_test_image()
        files = {'file': (f'TEST_bulk_file_{i}.png', io.BytesIO(test_image), 'image/png')}
        data = {'folder_id': ''}
        
        response = requests.post(
            f"{BASE_URL}/api/personal-files/upload",
            files=files,
            data=data,
            headers=headers
        )
        if response.status_code == 200:
            created_files.append(response.json())
    
    yield created_files
    
    # Cleanup: delete test files
    for f in created_files:
        try:
            admin_session.delete(f"{BASE_URL}/api/personal-files/files/{f['id']}")
        except:
            pass


@pytest.fixture(scope="module")
def test_folder(admin_session):
    """Create a test folder for bulk move operations"""
    folder_name = "TEST_BulkMoveTarget_" + str(os.urandom(4).hex())
    response = admin_session.post(f"{BASE_URL}/api/personal-files/folders", json={
        "name": folder_name
    })
    if response.status_code != 200:
        pytest.skip("Could not create test folder")
    
    folder = response.json()
    yield folder
    
    # Cleanup: delete test folder
    try:
        admin_session.delete(f"{BASE_URL}/api/personal-files/folders/{folder['id']}")
    except:
        pass


class TestBulkMoveFiles:
    """PUT /api/personal-files/files/bulk/move - Move multiple files to folder"""
    
    def test_bulk_move_to_folder(self, admin_session, test_files, test_folder):
        """Move multiple files to a specific folder"""
        if len(test_files) < 2:
            pytest.skip("Not enough test files")
        
        file_ids = [f['id'] for f in test_files[:2]]
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/move", json={
            "file_ids": file_ids,
            "folder_id": test_folder['id']
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "moved" in data
        assert data["moved"] == 2
        
        # Verify files are in the folder
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files", params={
            "folder_id": test_folder['id']
        })
        assert files_response.status_code == 200
        folder_files = files_response.json().get("files", [])
        folder_file_ids = [f['id'] for f in folder_files]
        
        for fid in file_ids:
            assert fid in folder_file_ids, f"File {fid} should be in folder"
    
    def test_bulk_move_to_root(self, admin_session, test_files, test_folder):
        """Move files back to root (folder_id=null)"""
        if len(test_files) < 2:
            pytest.skip("Not enough test files")
        
        file_ids = [f['id'] for f in test_files[:2]]
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/move", json={
            "file_ids": file_ids,
            "folder_id": None
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data["moved"] == 2
    
    def test_bulk_move_to_nonexistent_folder(self, admin_session, test_files):
        """Move to nonexistent folder returns 404"""
        if len(test_files) < 1:
            pytest.skip("Not enough test files")
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/move", json={
            "file_ids": [test_files[0]['id']],
            "folder_id": "nonexistent-folder-id-12345"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_bulk_move_empty_list(self, admin_session, test_folder):
        """Move empty file list returns 0 moved"""
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/move", json={
            "file_ids": [],
            "folder_id": test_folder['id']
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["moved"] == 0


class TestBulkAddTags:
    """PUT /api/personal-files/files/bulk/tags - Add tags to multiple files"""
    
    def test_bulk_add_tags(self, admin_session, test_files):
        """Add tags to multiple files"""
        if len(test_files) < 2:
            pytest.skip("Not enough test files")
        
        file_ids = [f['id'] for f in test_files[:2]]
        tags = ["bulk-test", "iteration54"]
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": file_ids,
            "tags": tags
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "updated" in data
        assert data["updated"] == 2
        
        # Verify tags were added
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        all_files = files_response.json().get("files", [])
        
        for fid in file_ids:
            file = next((f for f in all_files if f['id'] == fid), None)
            assert file is not None, f"File {fid} not found"
            file_tags = file.get("tags", [])
            for tag in tags:
                assert tag in file_tags, f"Tag '{tag}' should be in file {fid}"
    
    def test_bulk_add_tags_merges_existing(self, admin_session, test_files):
        """Adding tags merges with existing tags (no duplicates)"""
        if len(test_files) < 1:
            pytest.skip("Not enough test files")
        
        file_id = test_files[0]['id']
        
        # Add first set of tags
        admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": [file_id],
            "tags": ["tag-a", "tag-b"]
        })
        
        # Add second set (with overlap)
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": [file_id],
            "tags": ["tag-b", "tag-c"]
        })
        
        assert response.status_code == 200
        
        # Verify all tags present without duplicates
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        all_files = files_response.json().get("files", [])
        file = next((f for f in all_files if f['id'] == file_id), None)
        
        assert file is not None
        file_tags = file.get("tags", [])
        assert "tag-a" in file_tags
        assert "tag-b" in file_tags
        assert "tag-c" in file_tags
        # Check no duplicates
        assert file_tags.count("tag-b") == 1
    
    def test_bulk_add_tags_normalizes_lowercase(self, admin_session, test_files):
        """Tags are normalized to lowercase"""
        if len(test_files) < 1:
            pytest.skip("Not enough test files")
        
        file_id = test_files[0]['id']
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": [file_id],
            "tags": ["UPPERCASE", "MixedCase"]
        })
        
        assert response.status_code == 200
        
        # Verify tags are lowercase
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        all_files = files_response.json().get("files", [])
        file = next((f for f in all_files if f['id'] == file_id), None)
        
        assert file is not None
        file_tags = file.get("tags", [])
        assert "uppercase" in file_tags
        assert "mixedcase" in file_tags
        assert "UPPERCASE" not in file_tags
        assert "MixedCase" not in file_tags
    
    def test_bulk_add_empty_tags(self, admin_session, test_files):
        """Adding empty tags list returns 0 updated"""
        if len(test_files) < 1:
            pytest.skip("Not enough test files")
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": [test_files[0]['id']],
            "tags": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] == 0
    
    def test_bulk_add_tags_trims_whitespace(self, admin_session, test_files):
        """Tags with whitespace are trimmed"""
        if len(test_files) < 1:
            pytest.skip("Not enough test files")
        
        file_id = test_files[0]['id']
        
        response = admin_session.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": [file_id],
            "tags": ["  spacey  ", "  trimmed"]
        })
        
        assert response.status_code == 200
        
        # Verify tags are trimmed
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        all_files = files_response.json().get("files", [])
        file = next((f for f in all_files if f['id'] == file_id), None)
        
        assert file is not None
        file_tags = file.get("tags", [])
        assert "spacey" in file_tags
        assert "trimmed" in file_tags


class TestBulkDeleteFiles:
    """DELETE /api/personal-files/files/bulk - Delete multiple files"""
    
    def test_bulk_delete_files(self, admin_session):
        """Delete multiple files at once"""
        # Create files specifically for deletion test
        auth_header = admin_session.headers.get('Authorization', '')
        headers = {'Authorization': auth_header} if auth_header else {}
        
        created_ids = []
        for i in range(2):
            test_image = create_test_image()
            files = {'file': (f'TEST_delete_{i}.png', io.BytesIO(test_image), 'image/png')}
            response = requests.post(
                f"{BASE_URL}/api/personal-files/upload",
                files=files,
                data={'folder_id': ''},
                headers=headers
            )
            if response.status_code == 200:
                created_ids.append(response.json()['id'])
        
        if len(created_ids) < 2:
            pytest.skip("Could not create files for deletion test")
        
        # Bulk delete
        response = admin_session.delete(f"{BASE_URL}/api/personal-files/files/bulk", json={
            "file_ids": created_ids
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "deleted" in data
        assert data["deleted"] == 2
        
        # Verify files are gone
        files_response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        all_files = files_response.json().get("files", [])
        all_file_ids = [f['id'] for f in all_files]
        
        for fid in created_ids:
            assert fid not in all_file_ids, f"File {fid} should have been deleted"
    
    def test_bulk_delete_empty_list(self, admin_session):
        """Delete empty file list returns 0 deleted"""
        response = admin_session.delete(f"{BASE_URL}/api/personal-files/files/bulk", json={
            "file_ids": []
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == 0
    
    def test_bulk_delete_nonexistent_files(self, admin_session):
        """Delete nonexistent files returns 0 deleted (no error)"""
        response = admin_session.delete(f"{BASE_URL}/api/personal-files/files/bulk", json={
            "file_ids": ["nonexistent-id-1", "nonexistent-id-2"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] == 0


class TestBulkOperationsAuth:
    """Test authentication/authorization for bulk operations"""
    
    def test_bulk_move_requires_admin(self):
        """Bulk move requires admin authentication"""
        response = requests.put(f"{BASE_URL}/api/personal-files/files/bulk/move", json={
            "file_ids": ["test"],
            "folder_id": None
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_bulk_tags_requires_admin(self):
        """Bulk tags requires admin authentication"""
        response = requests.put(f"{BASE_URL}/api/personal-files/files/bulk/tags", json={
            "file_ids": ["test"],
            "tags": ["test"]
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_bulk_delete_requires_admin(self):
        """Bulk delete requires admin authentication"""
        response = requests.delete(f"{BASE_URL}/api/personal-files/files/bulk", json={
            "file_ids": ["test"]
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestExistingFilesWithTags:
    """Test bulk operations on existing files mentioned in context"""
    
    def test_get_existing_files_with_tags(self, admin_session):
        """Verify existing files with tags are accessible"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/files")
        assert response.status_code == 200
        
        files = response.json().get("files", [])
        
        # Find files with bulk-test tag (from previous iterations)
        bulk_test_files = [f for f in files if "bulk-test" in (f.get("tags") or [])]
        print(f"Found {len(bulk_test_files)} files with 'bulk-test' tag")
        
        # Find video files
        video_files = [f for f in files if f.get("file_type") == "video"]
        print(f"Found {len(video_files)} video files")
    
    def test_filter_by_tag(self, admin_session):
        """Filter files by tag parameter"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/files", params={
            "tag": "video"
        })
        assert response.status_code == 200
        
        files = response.json().get("files", [])
        # All returned files should have the 'video' tag
        for f in files:
            assert "video" in (f.get("tags") or []), f"File {f['id']} should have 'video' tag"
    
    def test_get_all_tags(self, admin_session):
        """Get all unique tags"""
        response = admin_session.get(f"{BASE_URL}/api/personal-files/tags")
        assert response.status_code == 200
        
        data = response.json()
        assert "tags" in data
        tags = data["tags"]
        
        print(f"Found {len(tags)} unique tags")
        for t in tags[:5]:
            print(f"  - {t['name']}: {t['count']} files")
